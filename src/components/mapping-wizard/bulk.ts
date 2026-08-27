/**
 * Sequential chunked dispatch for the Mapping Wizard's bulk actions.
 *
 * The wizard used to POST every checked id in one body, which the server
 * rejects above `BULK_MAX_ITEMS` — with ~5000 unmapped foods the bulk create in
 * issue #46 failed with `400 Invalid request body` before doing any work.
 *
 * Chunks run strictly one at a time: every bulk route takes the global sync
 * mutex, so concurrent chunks would only produce self-inflicted lock contention
 * against each other and the scheduler.
 *
 * Plain module (no hooks) so it is unit-testable without a DOM.
 */

/** Thrown by a `request` implementation when the server reports SYNC_LOCKED. */
export class SyncLockedError extends Error {
  readonly code = 'SYNC_LOCKED';

  constructor(message = 'A sync operation is already in progress.') {
    super(message);
    this.name = 'SyncLockedError';
  }
}

export function isSyncLockedError(error: unknown): error is SyncLockedError {
  return error instanceof SyncLockedError
    || (typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'SYNC_LOCKED');
}

export interface ChunkProgress {
  /** Items dispatched so far, including the chunk just completed. */
  done: number;
  total: number;
  /** 1-based index of the chunk just completed. */
  chunk: number;
  chunks: number;
}

export interface BulkOutcome {
  requested: number;
  succeeded: number;
  skipped: number;
  /** Items in a chunk that was attempted but did not complete. */
  failed: number;
  errors: string[];
  /** True when the run stopped early (abort signal or a failed chunk). */
  aborted: boolean;
  /**
   * Items never attempted because the run stopped early.
   *
   * Invariant: `succeeded + skipped + failed + remaining === requested` for any
   * server that classifies every id it is given.
   */
  remaining: number;
}

export interface LockRetryOptions {
  attempts: number;
  baseDelayMs: number;
}

export const DEFAULT_LOCK_RETRY: LockRetryOptions = { attempts: 3, baseDelayMs: 1000 };

export interface RunChunkedParams<TItem, TResult> {
  items: readonly TItem[];
  chunkSize: number;
  request: (chunk: TItem[], signal?: AbortSignal) => Promise<TResult>;
  /** Fold one chunk's response into the running outcome. */
  accumulate: (outcome: BulkOutcome, result: TResult, chunk: TItem[]) => void;
  onProgress?: (progress: ChunkProgress) => void;
  signal?: AbortSignal;
  lockRetry?: LockRetryOptions;
  /** Injectable for tests so backoff does not really sleep. */
  sleep?: (ms: number) => Promise<void>;
}

/** Split `items` into consecutive chunks of at most `chunkSize`. */
export function chunkItems<TItem>(items: readonly TItem[], chunkSize: number): TItem[][] {
  const size = Math.max(1, Math.floor(chunkSize));
  const chunks: TItem[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export async function runChunked<TItem, TResult>({
  items,
  chunkSize,
  request,
  accumulate,
  onProgress,
  signal,
  lockRetry = DEFAULT_LOCK_RETRY,
  sleep = defaultSleep,
}: RunChunkedParams<TItem, TResult>): Promise<BulkOutcome> {
  const chunks = chunkItems(items, chunkSize);
  const outcome: BulkOutcome = {
    requested: items.length,
    succeeded: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    aborted: false,
    remaining: items.length,
  };

  let dispatched = 0;

  for (const [index, chunk] of chunks.entries()) {
    if (signal?.aborted) {
      outcome.aborted = true;
      break;
    }

    let result: TResult | undefined;
    let lastError: unknown;
    let delivered = false;

    // Retry only a held sync lock; the scheduler releases it within a cycle.
    for (let attempt = 0; attempt <= lockRetry.attempts; attempt++) {
      try {
        result = await request(chunk, signal);
        delivered = true;
        break;
      } catch (error) {
        lastError = error;

        if (!isSyncLockedError(error) || attempt === lockRetry.attempts || signal?.aborted) {
          break;
        }

        await sleep(lockRetry.baseDelayMs * 2 ** attempt);
      }
    }

    if (!delivered) {
      // Stop rather than plough on: continuing would leave an unpredictable
      // partial state spread across the list with no way to tell where.
      //
      // The chunk counts as attempted even though it failed, so it must also
      // advance `dispatched`. Otherwise it is counted twice — once in `failed`
      // and again in `remaining` — and the summary describes more items than
      // were ever requested.
      outcome.failed += chunk.length;
      outcome.errors.push(describeError(lastError));
      outcome.aborted = true;
      dispatched += chunk.length;
      break;
    }

    accumulate(outcome, result as TResult, chunk);
    dispatched += chunk.length;
    outcome.remaining = items.length - dispatched;
    onProgress?.({ done: dispatched, total: items.length, chunk: index + 1, chunks: chunks.length });
  }

  outcome.remaining = Math.max(0, items.length - dispatched);
  return outcome;
}

/**
 * POST one chunk and normalize the failure modes `runChunked` cares about.
 *
 * A held sync lock arrives as `409 { code: 'SYNC_LOCKED' }` and becomes a
 * `SyncLockedError` so the chunk is retried; anything else is terminal.
 */
export async function postBulkChunk<TResult>(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<TResult> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  const result = await response.json().catch(() => null);

  if (response.status === 409 && result?.code === 'SYNC_LOCKED') {
    throw new SyncLockedError(result?.error);
  }

  if (!response.ok) {
    throw new Error(result?.error ?? `Request failed (${response.status})`);
  }

  return result as TResult;
}

/** Human-readable summary for the completion toast. */
export function summarizeOutcome(outcome: BulkOutcome, verb: string): string {
  const parts = [`${verb} ${outcome.succeeded}`];

  if (outcome.skipped > 0) parts.push(`${outcome.skipped} skipped`);
  if (outcome.failed > 0) parts.push(`${outcome.failed} failed`);
  if (outcome.aborted && outcome.remaining > 0) parts.push(`${outcome.remaining} not attempted`);

  return parts.join(', ');
}

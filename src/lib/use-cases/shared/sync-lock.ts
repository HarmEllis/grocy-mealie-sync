import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';

export interface SyncLockDeps {
  acquireSyncLock(): boolean;
  releaseSyncLock(): void;
}

export const defaultSyncLockDeps: SyncLockDeps = {
  acquireSyncLock,
  releaseSyncLock,
};

/**
 * Lock deps that always "succeed" without touching the real mutex. Used when a
 * caller already holds the sync lock and delegates to a use-case that would
 * otherwise try to acquire it again (the mutex is not reentrant).
 */
export const noopSyncLockDeps: SyncLockDeps = {
  acquireSyncLock: () => true,
  releaseSyncLock: () => {},
};

/**
 * Thrown when the sync lock could not be acquired within the deadline.
 *
 * Typed so routes can map it to a 409 with a stable machine-readable code:
 * a chunked bulk run has to retry on the code, never on message text. Extends
 * `Error` with the original message, so existing generic handlers are
 * unaffected.
 */
export class SyncLockTimeoutError extends Error {
  readonly code = 'SYNC_LOCKED';

  constructor(public readonly maxWaitMs: number) {
    super('A sync operation is already in progress. Please try again.');
    this.name = 'SyncLockTimeoutError';
  }
}

const DEFAULT_MAX_WAIT_MS = 10_000;
const DEFAULT_INTERVAL_MS = 250;

/**
 * Device actions must fail fast: the scanner firmware times out its HTTP request
 * sooner than the default wait, so a held sync lock has to surface as a JSON
 * error before the device gives up on the connection.
 */
export const DEVICE_SYNC_LOCK_MAX_WAIT_MS = 5_000;

export async function runWithSyncLock<T>(
  deps: SyncLockDeps,
  operation: () => Promise<T>,
  opts?: { maxWaitMs?: number; intervalMs?: number },
): Promise<T> {
  const maxWaitMs = opts?.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const intervalMs = opts?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const deadline = Date.now() + maxWaitMs;

  while (true) {
    if (deps.acquireSyncLock()) {
      try {
        return await operation();
      } finally {
        deps.releaseSyncLock();
      }
    }

    if (Date.now() >= deadline) {
      throw new SyncLockTimeoutError(maxWaitMs);
    }

    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }
}

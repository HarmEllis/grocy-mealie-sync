import { describe, expect, it, vi } from 'vitest';
import {
  chunkItems,
  isSyncLockedError,
  runChunked,
  SyncLockedError,
  type BulkOutcome,
} from '../bulk';

const ids = (count: number) => Array.from({ length: count }, (_, index) => `id-${index}`);
const noSleep = async () => {};

/** Mirrors how the wizard folds `{ created, skipped, failed }` into the outcome. */
function accumulateCounts(
  outcome: BulkOutcome,
  result: { created?: number; skipped?: number; failed?: number },
) {
  outcome.succeeded += result.created ?? 0;
  outcome.skipped += result.skipped ?? 0;
  outcome.failed += result.failed ?? 0;
}

describe('chunkItems', () => {
  it('splits into consecutive chunks of at most chunkSize', () => {
    expect(chunkItems([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns no chunks for an empty list', () => {
    expect(chunkItems([], 200)).toEqual([]);
  });

  it('never produces a zero-size chunk', () => {
    expect(chunkItems([1, 2], 0)).toEqual([[1], [2]]);
  });

  it('keeps 5000 items within the server cap', () => {
    const chunks = chunkItems(ids(5000), 200);
    expect(chunks).toHaveLength(25);
    expect(chunks.every(chunk => chunk.length <= 500)).toBe(true);
  });
});

describe('isSyncLockedError', () => {
  it('recognises the typed error and a plain coded object', () => {
    expect(isSyncLockedError(new SyncLockedError())).toBe(true);
    expect(isSyncLockedError({ code: 'SYNC_LOCKED' })).toBe(true);
  });

  it('does not match unrelated errors — retry keys on the code, not the message', () => {
    expect(isSyncLockedError(new Error('A sync operation is already in progress.'))).toBe(false);
    expect(isSyncLockedError(null)).toBe(false);
  });
});

describe('runChunked', () => {
  it('dispatches every item sequentially and accumulates counts', async () => {
    const seen: string[][] = [];
    const outcome = await runChunked({
      items: ids(5000),
      chunkSize: 200,
      request: async chunk => { seen.push(chunk); return { created: chunk.length }; },
      accumulate: accumulateCounts,
      sleep: noSleep,
    });

    expect(seen).toHaveLength(25);
    expect(seen.flat()).toHaveLength(5000);
    expect(outcome).toMatchObject({ requested: 5000, succeeded: 5000, failed: 0, aborted: false, remaining: 0 });
  });

  it('runs chunks one at a time, never concurrently', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    await runChunked({
      items: ids(10),
      chunkSize: 2,
      request: async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        return { created: 2 };
      },
      accumulate: accumulateCounts,
      sleep: noSleep,
    });

    expect(maxInFlight).toBe(1);
  });

  it('reports progress after each chunk', async () => {
    const progress: Array<{ done: number; chunk: number; chunks: number }> = [];

    await runChunked({
      items: ids(5),
      chunkSize: 2,
      request: async chunk => ({ created: chunk.length }),
      accumulate: accumulateCounts,
      onProgress: p => progress.push({ done: p.done, chunk: p.chunk, chunks: p.chunks }),
      sleep: noSleep,
    });

    expect(progress).toEqual([
      { done: 2, chunk: 1, chunks: 3 },
      { done: 4, chunk: 2, chunks: 3 },
      { done: 5, chunk: 3, chunks: 3 },
    ]);
  });

  it('retries a locked chunk with exponential backoff, then succeeds', async () => {
    const delays: number[] = [];
    let attempts = 0;

    const outcome = await runChunked({
      items: ids(2),
      chunkSize: 2,
      request: async chunk => {
        attempts += 1;
        if (attempts < 3) throw new SyncLockedError();
        return { created: chunk.length };
      },
      accumulate: accumulateCounts,
      sleep: async ms => { delays.push(ms); },
    });

    expect(attempts).toBe(3);
    expect(delays).toEqual([1000, 2000]);
    expect(outcome.succeeded).toBe(2);
    expect(outcome.aborted).toBe(false);
  });

  it('stops the run once lock retries are exhausted', async () => {
    const request = vi.fn(async () => { throw new SyncLockedError(); });

    const outcome = await runChunked({
      items: ids(600),
      chunkSize: 200,
      request,
      accumulate: accumulateCounts,
      lockRetry: { attempts: 2, baseDelayMs: 10 },
      sleep: noSleep,
    });

    // 3 attempts on the first chunk, then the run halts — chunks 2 and 3 are never sent.
    expect(request).toHaveBeenCalledTimes(3);
    expect(outcome.aborted).toBe(true);
    expect(outcome.failed).toBe(200);
    // The failed chunk was attempted, so it must not also be counted as
    // "not attempted" — the totals have to add up to `requested`.
    expect(outcome.remaining).toBe(400);
    expect(outcome.succeeded + outcome.skipped + outcome.failed + outcome.remaining).toBe(600);
  });

  it('does not retry a non-lock error, and stops rather than scattering partial state', async () => {
    const request = vi.fn(async (chunk: string[]) => {
      if (chunk[0] === 'id-200') throw new Error('Grocy unreachable');
      return { created: chunk.length };
    });

    const outcome = await runChunked({
      items: ids(600),
      chunkSize: 200,
      request,
      accumulate: accumulateCounts,
      sleep: noSleep,
    });

    expect(request).toHaveBeenCalledTimes(2);
    expect(outcome.succeeded).toBe(200);
    expect(outcome.failed).toBe(200);
    expect(outcome.remaining).toBe(200);
    expect(outcome.aborted).toBe(true);
    expect(outcome.errors).toEqual(['Grocy unreachable']);
    expect(outcome.succeeded + outcome.skipped + outcome.failed + outcome.remaining).toBe(600);
  });

  it('stops before the next chunk when aborted, keeping committed work', async () => {
    const controller = new AbortController();
    const request = vi.fn(async (chunk: string[]) => {
      controller.abort();
      return { created: chunk.length };
    });

    const outcome = await runChunked({
      items: ids(600),
      chunkSize: 200,
      request,
      accumulate: accumulateCounts,
      signal: controller.signal,
      sleep: noSleep,
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(outcome.succeeded).toBe(200);
    expect(outcome.aborted).toBe(true);
    expect(outcome.remaining).toBe(400);
  });

  it('accumulates skipped and failed counts reported by the server', async () => {
    const outcome = await runChunked({
      items: ids(4),
      chunkSize: 2,
      request: async () => ({ created: 1, skipped: 1, failed: 0 }),
      accumulate: accumulateCounts,
      sleep: noSleep,
    });

    expect(outcome).toMatchObject({ succeeded: 2, skipped: 2, failed: 0 });
  });

  it('handles an empty selection without dispatching anything', async () => {
    const request = vi.fn();
    const outcome = await runChunked({
      items: [],
      chunkSize: 200,
      request,
      accumulate: accumulateCounts,
      sleep: noSleep,
    });

    expect(request).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ requested: 0, succeeded: 0, aborted: false });
  });
});

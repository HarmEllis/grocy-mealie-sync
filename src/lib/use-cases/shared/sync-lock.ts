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
      throw new Error('A sync operation is already in progress. Please try again.');
    }

    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }
}

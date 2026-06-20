import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';

export interface SyncLockDeps {
  acquireSyncLock(): boolean;
  releaseSyncLock(): void;
}

export const defaultSyncLockDeps: SyncLockDeps = {
  acquireSyncLock,
  releaseSyncLock,
};

const DEFAULT_MAX_WAIT_MS = 10_000;
const DEFAULT_INTERVAL_MS = 250;

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

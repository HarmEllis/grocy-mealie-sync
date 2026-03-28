import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';

export interface SyncLockDeps {
  acquireSyncLock(): boolean;
  releaseSyncLock(): void;
}

export const defaultSyncLockDeps: SyncLockDeps = {
  acquireSyncLock,
  releaseSyncLock,
};

export async function runWithSyncLock<T>(
  deps: SyncLockDeps,
  operation: () => Promise<T>,
): Promise<T> {
  if (!deps.acquireSyncLock()) {
    throw new Error('A sync operation is already in progress. Please try again.');
  }

  try {
    return await operation();
  } finally {
    deps.releaseSyncLock();
  }
}

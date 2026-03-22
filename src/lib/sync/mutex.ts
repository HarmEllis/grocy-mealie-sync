let syncing = false;

export function acquireSyncLock(): boolean {
  if (syncing) return false;
  syncing = true;
  return true;
}

export function releaseSyncLock(): void {
  syncing = false;
}

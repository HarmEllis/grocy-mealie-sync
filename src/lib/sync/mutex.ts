import { randomUUID } from 'crypto';
import { sqlite } from '../db';

const SYNC_LOCK_NAME = 'sync-operation';
const SYNC_LOCK_TTL_MS = 5 * 60_000;
const syncOwnerId = randomUUID();

let syncing = false;

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS runtime_locks (
    name text PRIMARY KEY NOT NULL,
    owner_id text NOT NULL,
    expires_at integer NOT NULL
  )
`);

const acquireLeaseStatement = sqlite.prepare(`
  INSERT INTO runtime_locks (name, owner_id, expires_at)
  VALUES (@name, @ownerId, @expiresAt)
  ON CONFLICT(name) DO UPDATE SET
    owner_id = excluded.owner_id,
    expires_at = excluded.expires_at
  WHERE runtime_locks.expires_at <= @now
     OR runtime_locks.owner_id = @ownerId
`);

const releaseLeaseStatement = sqlite.prepare(`
  DELETE FROM runtime_locks
  WHERE name = @name
    AND owner_id = @ownerId
`);

export function acquireLease(name: string, ownerId: string, ttlMs: number): boolean {
  const now = Date.now();
  const expiresAt = now + ttlMs;
  const result = acquireLeaseStatement.run({
    name,
    ownerId,
    expiresAt,
    now,
  });
  return result.changes > 0;
}

export function releaseLease(name: string, ownerId: string): void {
  releaseLeaseStatement.run({ name, ownerId });
}

export function acquireSyncLock(): boolean {
  if (syncing) {
    return false;
  }

  const acquired = acquireLease(SYNC_LOCK_NAME, syncOwnerId, SYNC_LOCK_TTL_MS);
  if (!acquired) {
    return false;
  }

  syncing = true;
  return true;
}

export function releaseSyncLock(): void {
  syncing = false;
  releaseLease(SYNC_LOCK_NAME, syncOwnerId);
}

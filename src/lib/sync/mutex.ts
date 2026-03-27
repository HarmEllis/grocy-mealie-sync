import { randomUUID } from 'crypto';
import { sqlite } from '../db';
import { config } from '../config';

const SYNC_LOCK_NAME = 'sync-operation';
const SCHEDULER_LOCK_NAME = 'scheduler-startup';
const MIN_SYNC_LOCK_TTL_MS = 15_000;
const PERSISTENT_LOCK_EXPIRES_AT_MS = 253_402_300_799_000;
const instanceOwnerId = randomUUID();

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

const acquirePersistentLockStatement = sqlite.prepare(`
  INSERT INTO runtime_locks (name, owner_id, expires_at)
  VALUES (@name, @ownerId, @expiresAt)
  ON CONFLICT(name) DO NOTHING
`);

const releaseLeaseStatement = sqlite.prepare(`
  DELETE FROM runtime_locks
  WHERE name = @name
    AND owner_id = @ownerId
`);

const clearLeaseStatement = sqlite.prepare(`
  DELETE FROM runtime_locks
  WHERE name = @name
`);

export function computeSyncLockTtlMs(pollIntervalSeconds: number): number {
  return Math.max(MIN_SYNC_LOCK_TTL_MS, pollIntervalSeconds * 2 * 1000);
}

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

export function clearLease(name: string): boolean {
  const result = clearLeaseStatement.run({ name });
  return result.changes > 0;
}

export function acquireSchedulerLock(): boolean {
  const result = acquirePersistentLockStatement.run({
    name: SCHEDULER_LOCK_NAME,
    ownerId: instanceOwnerId,
    expiresAt: PERSISTENT_LOCK_EXPIRES_AT_MS,
  });
  return result.changes > 0;
}

export function releaseSchedulerLock(): void {
  releaseLease(SCHEDULER_LOCK_NAME, instanceOwnerId);
}

export function clearSchedulerLock(): boolean {
  return clearLease(SCHEDULER_LOCK_NAME);
}

export function acquireSyncLock(): boolean {
  if (syncing) {
    return false;
  }

  const acquired = acquireLease(
    SYNC_LOCK_NAME,
    instanceOwnerId,
    computeSyncLockTtlMs(config.pollIntervalSeconds),
  );
  if (!acquired) {
    return false;
  }

  syncing = true;
  return true;
}

export function releaseSyncLock(): void {
  syncing = false;
  releaseLease(SYNC_LOCK_NAME, instanceOwnerId);
}

export function clearSyncLock(): boolean {
  syncing = false;
  return clearLease(SYNC_LOCK_NAME);
}

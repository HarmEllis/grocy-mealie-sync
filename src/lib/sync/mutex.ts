import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { config } from '../config';
import { runtimeLocks } from '../db/schema';

const SYNC_LOCK_NAME = 'sync-operation';
const SCHEDULER_LOCK_NAME = 'scheduler-startup';
const MIN_SYNC_LOCK_TTL_MS = 15_000;
const PERSISTENT_LOCK_EXPIRES_AT_MS = 253_402_300_799_000;
const instanceOwnerId = randomUUID();

let syncing = false;

export function computeSyncLockTtlMs(pollIntervalSeconds: number): number {
  return Math.max(MIN_SYNC_LOCK_TTL_MS, pollIntervalSeconds * 2 * 1000);
}

export function acquireLease(name: string, ownerId: string, ttlMs: number): boolean {
  const now = Date.now();
  const expiresAt = now + ttlMs;

  return db.transaction((tx) => {
    const existingLock = tx.select().from(runtimeLocks).where(eq(runtimeLocks.name, name)).get();

    if (existingLock && existingLock.expiresAt > now && existingLock.ownerId !== ownerId) {
      return false;
    }

    tx.insert(runtimeLocks)
      .values({
        name,
        ownerId,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: runtimeLocks.name,
        set: {
          ownerId,
          expiresAt,
        },
      })
      .run();

    return true;
  });
}

export function releaseLease(name: string, ownerId: string): void {
  db.delete(runtimeLocks)
    .where(and(
      eq(runtimeLocks.name, name),
      eq(runtimeLocks.ownerId, ownerId),
    ))
    .run();
}

export function clearLease(name: string): boolean {
  const result = db.delete(runtimeLocks)
    .where(eq(runtimeLocks.name, name))
    .run();
  return result.changes > 0;
}

export function acquireSchedulerLock(): boolean {
  const result = db.insert(runtimeLocks)
    .values({
      name: SCHEDULER_LOCK_NAME,
      ownerId: instanceOwnerId,
      expiresAt: PERSISTENT_LOCK_EXPIRES_AT_MS,
    })
    .onConflictDoNothing()
    .run();
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

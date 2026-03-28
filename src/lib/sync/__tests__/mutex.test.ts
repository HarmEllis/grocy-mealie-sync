import path from 'path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.DATABASE_PATH = './data/mutex-test.db';

import { db } from '../../db';
import { runtimeLocks } from '../../db/schema';
import {
  acquireSchedulerLock,
  acquireLease,
  acquireSyncLock,
  clearSchedulerLock,
  clearSyncLock,
  computeSyncLockTtlMs,
  releaseLease,
  releaseSchedulerLock,
  releaseSyncLock,
} from '../mutex';

describe('sync mutex', () => {
  beforeEach(() => {
    migrate(db, { migrationsFolder: path.resolve('drizzle') });
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-27T12:00:00.000Z'));
    db.delete(runtimeLocks).run();
    releaseSyncLock();
  });

  afterEach(() => {
    releaseSyncLock();
    db.delete(runtimeLocks).run();
    vi.useRealTimers();
  });

  it('scheduler startup lock can only be acquired once until it is released', () => {
    expect(acquireSchedulerLock()).toBe(true);
    expect(acquireSchedulerLock()).toBe(false);

    releaseSchedulerLock();

    expect(acquireSchedulerLock()).toBe(true);
  });

  it('can clear the scheduler startup lock explicitly', () => {
    expect(acquireSchedulerLock()).toBe(true);

    expect(clearSchedulerLock()).toBe(true);
    expect(acquireSchedulerLock()).toBe(true);
  });

  it('first acquire succeeds', () => {
    expect(acquireSyncLock()).toBe(true);
  });

  it('second acquire while locked fails', () => {
    acquireSyncLock();
    expect(acquireSyncLock()).toBe(false);
  });

  it('release allows re-acquire', () => {
    acquireSyncLock();
    releaseSyncLock();
    expect(acquireSyncLock()).toBe(true);
  });

  it('double release does not throw', () => {
    acquireSyncLock();
    releaseSyncLock();
    expect(() => releaseSyncLock()).not.toThrow();
  });

  it('release before any acquire does not throw', () => {
    expect(() => releaseSyncLock()).not.toThrow();
    // Should still be acquirable after no-op release
    expect(acquireSyncLock()).toBe(true);
  });

  it('blocks a different owner while a lease is still valid', () => {
    expect(acquireLease('test-lock', 'owner-a', 1000)).toBe(true);
    expect(acquireLease('test-lock', 'owner-b', 1000)).toBe(false);
  });

  it('allows takeover after a lease expires', () => {
    expect(acquireLease('test-lock', 'owner-a', 1000)).toBe(true);

    vi.setSystemTime(new Date('2026-03-27T12:00:01.001Z'));

    expect(acquireLease('test-lock', 'owner-b', 1000)).toBe(true);
  });

  it('releases a named lease so another owner can acquire it immediately', () => {
    expect(acquireLease('test-lock', 'owner-a', 1000)).toBe(true);

    releaseLease('test-lock', 'owner-a');

    expect(acquireLease('test-lock', 'owner-b', 1000)).toBe(true);
  });

  it('derives the sync lock TTL from the poll interval with a floor', () => {
    expect(computeSyncLockTtlMs(5)).toBe(15_000);
    expect(computeSyncLockTtlMs(60)).toBe(120_000);
  });

  it('can clear the sync lock explicitly', () => {
    expect(acquireSyncLock()).toBe(true);

    expect(clearSyncLock()).toBe(true);
    expect(acquireSyncLock()).toBe(true);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { acquireSyncLock, releaseSyncLock } from '../mutex';

describe('sync mutex', () => {
  beforeEach(() => {
    // Ensure clean state before each test
    releaseSyncLock();
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
});

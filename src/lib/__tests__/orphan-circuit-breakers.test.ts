import { describe, it, expect } from 'vitest';
import { checkOrphanDeletionSafety } from '../orphan-checks';

describe('checkOrphanDeletionSafety', () => {
  it('allows deletion when within safe thresholds', () => {
    const result = checkOrphanDeletionSafety(100, 200, 10);
    expect(result.allowed).toBe(true);
  });

  it('refuses when upstream returns 0 items', () => {
    const result = checkOrphanDeletionSafety(0, 200, 10);
    expect(result.allowed).toBe(false);
    expect(result.statusCode).toBe(503);
    expect(result.reason).toContain('no items');
  });

  it('refuses when deletion exceeds 50% of Grocy items', () => {
    const result = checkOrphanDeletionSafety(100, 20, 11);
    expect(result.allowed).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(result.reason).toContain('>50%');
  });

  it('allows deletion at exactly 50%', () => {
    const result = checkOrphanDeletionSafety(100, 20, 10);
    expect(result.allowed).toBe(true);
  });

  it('allows deletion when Grocy has 0 items', () => {
    const result = checkOrphanDeletionSafety(100, 0, 0);
    expect(result.allowed).toBe(true);
  });

  it('refuses deletion of 1 item when Grocy has only 1 item', () => {
    // 1 > 1 * 0.5 = 0.5, so this should be refused
    const result = checkOrphanDeletionSafety(100, 1, 1);
    expect(result.allowed).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  it('allows deletion of 0 items regardless', () => {
    const result = checkOrphanDeletionSafety(100, 200, 0);
    expect(result.allowed).toBe(true);
  });
});

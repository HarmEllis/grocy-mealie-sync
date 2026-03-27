import { describe, expect, it } from 'vitest';
import { isBelowMinimumStock } from '../stock';

describe('isBelowMinimumStock', () => {
  it('returns true when the current stock is strictly below the minimum', () => {
    expect(isBelowMinimumStock(1, 2)).toBe(true);
  });

  it('returns false when stock is equal to or above the minimum', () => {
    expect(isBelowMinimumStock(2, 2)).toBe(false);
    expect(isBelowMinimumStock(3, 2)).toBe(false);
  });

  it('returns false when no minimum stock is configured', () => {
    expect(isBelowMinimumStock(0, 0)).toBe(false);
  });
});

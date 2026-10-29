import { describe, expect, it } from 'vitest';
import { formatAmount, packageLabel, packageMismatch } from '../products/package-size';

const product = (packageAmount: number | null, packageUnit: string | null, measure = 'unit') => ({ measure, packageAmount, packageUnit });

describe('packageLabel', () => {
  it('names the package size so two products with one name can be told apart', () => {
    expect(packageLabel(product(200, 'g'))).toBe('200 g');
    expect(packageLabel(product(70, 'g'))).toBe('70 g');
    expect(packageLabel(product(null, null))).toBeNull();
    expect(packageLabel(product(1, 'kg', 'weight'))).toBe('per kg');
    expect(packageLabel(undefined)).toBeNull();
  });
});

describe('packageMismatch', () => {
  it('flags a 200 g package saved as 70 gram, and accepts the right amount', () => {
    expect(packageMismatch(product(200, 'g'), 70, 'gram')).toEqual({ expected: 200, actual: 70 });
    expect(packageMismatch(product(200, 'g'), 200, 'gram')).toBeNull();
    expect(packageMismatch(product(70, 'g'), 200, 'gram')).toEqual({ expected: 70, actual: 200 });
  });

  it('converts between compatible units before comparing', () => {
    expect(packageMismatch(product(500, 'g'), 0.5, 'kilogram')).toBeNull();
    expect(packageMismatch(product(500, 'g'), 5, 'kilogram')).toEqual({ expected: 0.5, actual: 5 });
  });

  it('never judges what the unit library cannot compare', () => {
    expect(packageMismatch(product(200, 'g'), 3, 'blik')).toBeNull();
    expect(packageMismatch(product(200, 'g'), 1, 'stuk')).toBeNull();
    expect(packageMismatch(product(null, null), 1, 'gram')).toBeNull();
    expect(packageMismatch(product(200, 'g'), null, 'gram')).toBeNull();
    expect(packageMismatch(undefined, 70, 'gram')).toBeNull();
  });

  it('does not contradict a package size the retailer never reported', () => {
    // The library falls back to 1 for a count unit; that default says nothing about a multi-pack.
    expect(packageMismatch(product(null, null), 4, 'stuk')).toBeNull();
    expect(packageMismatch(product(4, null), 4, 'stuk')).toBeNull();
    expect(packageMismatch(product(null, 'piece'), 6, 'stuk')).toBeNull();
  });

  it('judges a package given in pieces against a count unit', () => {
    expect(packageMismatch(product(6, 'piece'), 6, 'stuk')).toBeNull();
    expect(packageMismatch(product(6, 'piece'), 1, 'stuk')).toEqual({ expected: 6, actual: 1 });
  });
});

describe('formatAmount', () => {
  it('trims floating point noise', () => {
    expect(formatAmount(200 / 70)).toBe('2.857');
    expect(formatAmount(70)).toBe('70');
  });
});

import { describe, expect, it } from 'vitest';
import {
  findDuplicateGrocyProductAssignment,
  findDuplicateGrocyUnitAssignment,
  findProductMappingConflict,
  findUnitMappingConflict,
  formatProductMappingConflictMessage,
  formatUnitMappingConflictMessage,
} from '../mapping-conflicts';

describe('mapping conflict helpers', () => {
  it('finds an existing product conflict for the same Grocy product', () => {
    expect(findProductMappingConflict([
      { mealieFoodId: 'food-a', mealieFoodName: 'Milk', grocyProductId: 101, grocyProductName: 'Milk' },
    ], 'food-b', 101)).toEqual({
      mealieFoodId: 'food-a',
      mealieFoodName: 'Milk',
      grocyProductId: 101,
      grocyProductName: 'Milk',
    });
  });

  it('finds an existing unit conflict for the same Grocy unit', () => {
    expect(findUnitMappingConflict([
      { mealieUnitId: 'unit-a', mealieUnitName: 'Liter', grocyUnitId: 10, grocyUnitName: 'Liter' },
    ], 'unit-b', 10)).toEqual({
      mealieUnitId: 'unit-a',
      mealieUnitName: 'Liter',
      grocyUnitId: 10,
      grocyUnitName: 'Liter',
    });
  });

  it('detects duplicate Grocy product assignments in the same request', () => {
    expect(findDuplicateGrocyProductAssignment([
      { mealieFoodId: 'food-a', grocyProductId: 101 },
      { mealieFoodId: 'food-b', grocyProductId: 101 },
    ])).toEqual({
      grocyProductId: 101,
      mealieFoodIds: ['food-a', 'food-b'],
    });
  });

  it('detects duplicate Grocy unit assignments in the same request', () => {
    expect(findDuplicateGrocyUnitAssignment([
      { mealieUnitId: 'unit-a', grocyUnitId: 10 },
      { mealieUnitId: 'unit-b', grocyUnitId: 10 },
    ])).toEqual({
      grocyUnitId: 10,
      mealieUnitIds: ['unit-a', 'unit-b'],
    });
  });

  it('formats readable product conflict messages', () => {
    expect(formatProductMappingConflictMessage({
      mealieFoodId: 'food-a',
      mealieFoodName: 'Milk',
      grocyProductId: 101,
      grocyProductName: 'Milk',
    })).toBe('Grocy product "Milk" (#101) is already mapped to Mealie food "Milk".');
  });

  it('formats readable unit conflict messages', () => {
    expect(formatUnitMappingConflictMessage({
      mealieUnitId: 'unit-a',
      mealieUnitName: 'Liter',
      grocyUnitId: 10,
      grocyUnitName: 'Liter',
    })).toBe('Grocy unit "Liter" (#10) is already mapped to Mealie unit "Liter".');
  });
});

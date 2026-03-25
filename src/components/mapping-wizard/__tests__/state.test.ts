import { describe, expect, it } from 'vitest';
import type { WizardData } from '../types';
import {
  buildProductMaps,
  buildUnitMaps,
  getDefaultWizardTab,
  mergeCheckedState,
  mergeProductMaps,
  mergeUnitMaps,
} from '../state';

function createWizardData(overrides: Partial<WizardData> = {}): WizardData {
  return {
    unmappedMealieFoods: [
      { id: 'food-1', name: 'Milk' },
      { id: 'food-2', name: 'Bread' },
    ],
    unmappedMealieUnits: [
      { id: 'unit-1', name: 'Piece', abbreviation: 'pc' },
      { id: 'unit-2', name: 'Liter', abbreviation: 'l' },
    ],
    grocyProducts: [
      { id: 1, name: 'Milk', quIdPurchase: 10 },
      { id: 2, name: 'Bread', quIdPurchase: 11 },
    ],
    grocyUnits: [
      { id: 10, name: 'Piece' },
      { id: 11, name: 'Liter' },
    ],
    existingUnitMappings: [],
    productSuggestions: {},
    unitSuggestions: {},
    orphanGrocyProductCount: 0,
    orphanGrocyUnitCount: 0,
    ...overrides,
  };
}

describe('getDefaultWizardTab', () => {
  it('defaults to units when there are unmapped units', () => {
    expect(getDefaultWizardTab(createWizardData())).toBe('units');
  });

  it('defaults to products when only products remain', () => {
    expect(getDefaultWizardTab(createWizardData({ unmappedMealieUnits: [] }))).toBe('products');
  });
});

describe('buildProductMaps', () => {
  it('creates empty product mappings for all unmapped foods', () => {
    expect(buildProductMaps(createWizardData())).toEqual({
      'food-1': { mealieFoodId: 'food-1', grocyProductId: null, grocyUnitId: null },
      'food-2': { mealieFoodId: 'food-2', grocyProductId: null, grocyUnitId: null },
    });
  });
});

describe('buildUnitMaps', () => {
  it('creates empty unit mappings for all unmapped units', () => {
    expect(buildUnitMaps(createWizardData())).toEqual({
      'unit-1': { mealieUnitId: 'unit-1', grocyUnitId: null },
      'unit-2': { mealieUnitId: 'unit-2', grocyUnitId: null },
    });
  });
});

describe('mergeProductMaps', () => {
  it('preserves existing selections and drops items that are no longer unmapped', () => {
    const merged = mergeProductMaps(
      createWizardData({
        unmappedMealieFoods: [
          { id: 'food-2', name: 'Bread' },
          { id: 'food-3', name: 'Eggs' },
        ],
      }),
      {
        'food-1': { mealieFoodId: 'food-1', grocyProductId: 1, grocyUnitId: 10 },
        'food-2': { mealieFoodId: 'food-2', grocyProductId: 2, grocyUnitId: 11 },
      },
    );

    expect(merged).toEqual({
      'food-2': { mealieFoodId: 'food-2', grocyProductId: 2, grocyUnitId: 11 },
      'food-3': { mealieFoodId: 'food-3', grocyProductId: null, grocyUnitId: null },
    });
  });
});

describe('mergeUnitMaps', () => {
  it('preserves existing selections and adds new units with empty state', () => {
    const merged = mergeUnitMaps(
      createWizardData({
        unmappedMealieUnits: [
          { id: 'unit-2', name: 'Liter', abbreviation: 'l' },
          { id: 'unit-3', name: 'Gram', abbreviation: 'g' },
        ],
      }),
      {
        'unit-1': { mealieUnitId: 'unit-1', grocyUnitId: 10 },
        'unit-2': { mealieUnitId: 'unit-2', grocyUnitId: 11 },
      },
    );

    expect(merged).toEqual({
      'unit-2': { mealieUnitId: 'unit-2', grocyUnitId: 11 },
      'unit-3': { mealieUnitId: 'unit-3', grocyUnitId: null },
    });
  });
});

describe('mergeCheckedState', () => {
  it('keeps only checked ids that still exist after a refresh', () => {
    expect(mergeCheckedState(['food-2', 'food-3'], {
      'food-1': true,
      'food-2': true,
      'food-3': false,
    })).toEqual({
      'food-2': true,
    });
  });
});

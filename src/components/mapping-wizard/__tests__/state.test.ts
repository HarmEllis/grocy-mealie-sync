import { describe, expect, it } from 'vitest';
import type { WizardData } from '../types';
import {
  buildGrocyMinStockProductMaps,
  buildProductMaps,
  buildUnitMaps,
  getPendingUnitMappings,
  buildTakenTargetIds,
  getDefaultWizardTab,
  mergeCheckedState,
  mergeGrocyMinStockProductMaps,
  mergeProductMaps,
  mergeUnitMaps,
  toMappedUnitOptions,
} from '../state';

function createWizardData(overrides: Partial<WizardData> = {}): WizardData {
  return {
    unmappedMealieFoods: [
      { id: 'food-1', name: 'Milk' },
      { id: 'food-2', name: 'Bread' },
    ],
    mealieUnits: [
      { id: 'unit-1', name: 'Piece', abbreviation: 'pc' },
      { id: 'unit-2', name: 'Liter', abbreviation: 'l' },
    ],
    unmappedMealieUnits: [
      { id: 'unit-1', name: 'Piece', abbreviation: 'pc' },
      { id: 'unit-2', name: 'Liter', abbreviation: 'l' },
    ],
    grocyProducts: [
      { id: 1, name: 'Milk', quIdPurchase: 10, minStockAmount: 1 },
      { id: 2, name: 'Bread', quIdPurchase: 11, minStockAmount: 0 },
    ],
    grocyUnits: [
      { id: 10, name: 'Piece' },
      { id: 11, name: 'Liter' },
    ],
    unmappedGrocyUnits: [],
    unmappedGrocyMinStockProducts: [
      { id: 1, name: 'Milk', quIdPurchase: 10, minStockAmount: 1, currentStock: 0, isBelowMinimum: true },
    ],
    existingUnitMappings: [],
    productSuggestions: {},
    lowStockGrocyProductSuggestions: {},
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

  it('defaults to grocy min stock when only that tab still has items', () => {
    expect(getDefaultWizardTab(createWizardData({
      unmappedMealieUnits: [],
      unmappedMealieFoods: [],
    }))).toBe('grocy-min-stock');
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
  it('creates unit mappings for all mealie units, including existing mapped units', () => {
    expect(buildUnitMaps(createWizardData({
      existingUnitMappings: [
        {
          id: 'map-1',
          mealieUnitId: 'unit-1',
          mealieUnitName: 'Piece',
          mealieUnitAbbreviation: 'pc',
          grocyUnitId: 10,
          grocyUnitName: 'Piece',
        },
      ],
      unmappedMealieUnits: [
        { id: 'unit-2', name: 'Liter', abbreviation: 'l' },
      ],
    }))).toEqual({
      'unit-1': { mealieUnitId: 'unit-1', grocyUnitId: 10 },
      'unit-2': { mealieUnitId: 'unit-2', grocyUnitId: null },
    });
  });
});

describe('buildGrocyMinStockProductMaps', () => {
  it('creates empty reverse product mappings for all unmapped Grocy min-stock products', () => {
    expect(buildGrocyMinStockProductMaps(createWizardData())).toEqual({
      '1': { grocyProductId: 1, mealieFoodId: null, grocyUnitId: 10 },
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
  it('preserves existing selections, keeps existing mappings, and adds new units with empty state', () => {
    const merged = mergeUnitMaps(
      createWizardData({
        mealieUnits: [
          { id: 'unit-1', name: 'Piece', abbreviation: 'pc' },
          { id: 'unit-2', name: 'Liter', abbreviation: 'l' },
          { id: 'unit-3', name: 'Gram', abbreviation: 'g' },
        ],
        unmappedMealieUnits: [
          { id: 'unit-2', name: 'Liter', abbreviation: 'l' },
        ],
        existingUnitMappings: [
          {
            id: 'map-1',
            mealieUnitId: 'unit-1',
            mealieUnitName: 'Piece',
            mealieUnitAbbreviation: 'pc',
            grocyUnitId: 10,
            grocyUnitName: 'Piece',
          },
        ],
      }),
      {
        'unit-1': { mealieUnitId: 'unit-1', grocyUnitId: 10 },
        'unit-2': { mealieUnitId: 'unit-2', grocyUnitId: 11 },
      },
    );

    expect(merged).toEqual({
      'unit-1': { mealieUnitId: 'unit-1', grocyUnitId: 10 },
      'unit-2': { mealieUnitId: 'unit-2', grocyUnitId: 11 },
      'unit-3': { mealieUnitId: 'unit-3', grocyUnitId: null },
    });
  });
});

describe('mergeGrocyMinStockProductMaps', () => {
  it('preserves existing reverse selections and adds new products with empty state', () => {
    const merged = mergeGrocyMinStockProductMaps(
      createWizardData({
        unmappedGrocyMinStockProducts: [
          { id: 1, name: 'Milk', quIdPurchase: 10, minStockAmount: 1, currentStock: 0, isBelowMinimum: true },
          { id: 3, name: 'Eggs', quIdPurchase: 12, minStockAmount: 6, currentStock: 1, isBelowMinimum: true },
        ],
      }),
      {
        '1': { grocyProductId: 1, mealieFoodId: 'food-1', grocyUnitId: 10 },
        '2': { grocyProductId: 2, mealieFoodId: 'food-2', grocyUnitId: 11 },
      },
    );

    expect(merged).toEqual({
      '1': { grocyProductId: 1, mealieFoodId: 'food-1', grocyUnitId: 10 },
      '3': { grocyProductId: 3, mealieFoodId: null, grocyUnitId: 12 },
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

  it('supports numeric ids by stringifying them', () => {
    expect(mergeCheckedState([1, 2], {
      '1': true,
      '2': false,
      '3': true,
    })).toEqual({
      '1': true,
    });
  });
});

describe('getPendingUnitMappings', () => {
  it('returns only new or changed unit mappings, not unchanged persisted ones', () => {
    const data = createWizardData({
      mealieUnits: [
        { id: 'unit-1', name: 'Piece', abbreviation: 'pc' },
        { id: 'unit-2', name: 'Liter', abbreviation: 'l' },
        { id: 'unit-3', name: 'Gram', abbreviation: 'g' },
      ],
      existingUnitMappings: [
        {
          id: 'map-1',
          mealieUnitId: 'unit-1',
          mealieUnitName: 'Piece',
          mealieUnitAbbreviation: 'pc',
          grocyUnitId: 10,
          grocyUnitName: 'Piece',
        },
        {
          id: 'map-2',
          mealieUnitId: 'unit-2',
          mealieUnitName: 'Liter',
          mealieUnitAbbreviation: 'l',
          grocyUnitId: 11,
          grocyUnitName: 'Liter',
        },
      ],
    });

    expect(getPendingUnitMappings(data, {
      'unit-1': { mealieUnitId: 'unit-1', grocyUnitId: 10 },
      'unit-2': { mealieUnitId: 'unit-2', grocyUnitId: 12 },
      'unit-3': { mealieUnitId: 'unit-3', grocyUnitId: 13 },
    })).toEqual([
      { mealieUnitId: 'unit-2', grocyUnitId: 12 },
      { mealieUnitId: 'unit-3', grocyUnitId: 13 },
    ]);
  });
});

describe('buildTakenTargetIds', () => {
  it('collects assigned target ids and skips unassigned drafts', () => {
    const taken = buildTakenTargetIds(
      {
        a: { mealieFoodId: 'a', grocyProductId: 1, grocyUnitId: null },
        b: { mealieFoodId: 'b', grocyProductId: null, grocyUnitId: null },
        c: { mealieFoodId: 'c', grocyProductId: 7, grocyUnitId: null },
      },
      mapping => mapping.grocyProductId,
    );

    expect(taken).toEqual(new Set([1, 7]));
  });

  it('returns an empty set for an empty draft map', () => {
    expect(buildTakenTargetIds({}, (m: { id: number | null }) => m.id).size).toBe(0);
  });

  it('deduplicates a target claimed twice', () => {
    const taken = buildTakenTargetIds(
      { a: { id: 4 }, b: { id: 4 } },
      (mapping: { id: number | null }) => mapping.id,
    );

    expect(taken).toEqual(new Set([4]));
  });

  it('supports string target ids (reverse min-stock direction)', () => {
    const taken = buildTakenTargetIds(
      {
        '10': { grocyProductId: 10, mealieFoodId: 'food-a', grocyUnitId: null },
        '11': { grocyProductId: 11, mealieFoodId: null, grocyUnitId: null },
      },
      mapping => mapping.mealieFoodId,
    );

    expect(taken).toEqual(new Set(['food-a']));
  });
});

describe('toMappedUnitOptions', () => {
  const mapping = (grocyUnitId: number, grocyUnitName: string) => ({
    id: `map-${grocyUnitId}`,
    mealieUnitId: `unit-${grocyUnitId}`,
    mealieUnitName: grocyUnitName,
    mealieUnitAbbreviation: '',
    grocyUnitId,
    grocyUnitName,
  });

  it('offers the Grocy unit of every mapping, sorted by name', () => {
    expect(toMappedUnitOptions([mapping(11, 'Liter'), mapping(10, 'Bak')])).toEqual([
      { value: 10, label: 'Bak' },
      { value: 11, label: 'Liter' },
    ]);
  });

  it('offers nothing when no unit is mapped, so no unmappable unit can be picked', () => {
    expect(toMappedUnitOptions([])).toEqual([]);
  });
});

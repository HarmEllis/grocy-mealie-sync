import { describe, expect, it } from 'vitest';
import { detectMappingConflicts } from '../mapping-conflicts-detection';

describe('detectMappingConflicts', () => {
  it('detects missing unit references for previously valid unit mappings', () => {
    const conflicts = detectMappingConflicts({
      productMappings: [],
      unitMappings: [
        {
          id: 'unit-map-1',
          mealieUnitId: 'unit-1',
          mealieUnitName: 'Liter',
          grocyUnitId: 10,
          grocyUnitName: 'Liter',
        },
        {
          id: 'unit-map-2',
          mealieUnitId: 'unit-2',
          mealieUnitName: 'Gram',
          grocyUnitId: 11,
          grocyUnitName: 'Gram',
        },
      ],
      mealieFoods: [],
      mealieUnits: [
        { id: 'unit-2', name: 'Gram' },
      ],
      grocyProducts: [],
      grocyUnits: [
        { id: 10, name: 'Liter' },
      ],
    });

    expect(conflicts).toEqual([
      expect.objectContaining({
        type: 'missing_mealie_unit',
        mappingKind: 'unit',
        mappingId: 'unit-map-1',
        sourceTab: 'units',
        mealieId: 'unit-1',
        grocyId: 10,
      }),
      expect.objectContaining({
        type: 'missing_grocy_unit',
        mappingKind: 'unit',
        mappingId: 'unit-map-2',
        sourceTab: 'units',
        mealieId: 'unit-2',
        grocyId: 11,
      }),
    ]);
  });

  it('detects missing product references and broken product-unit references', () => {
    const conflicts = detectMappingConflicts({
      productMappings: [
        {
          id: 'product-map-1',
          mealieFoodId: 'food-1',
          mealieFoodName: 'Milk',
          grocyProductId: 101,
          grocyProductName: 'Milk',
          unitMappingId: 'unit-map-1',
        },
        {
          id: 'product-map-2',
          mealieFoodId: 'food-2',
          mealieFoodName: 'Rice',
          grocyProductId: 102,
          grocyProductName: 'Rice',
          unitMappingId: 'missing-unit-map',
        },
        {
          id: 'product-map-3',
          mealieFoodId: 'food-3',
          mealieFoodName: 'Salt',
          grocyProductId: 103,
          grocyProductName: 'Salt',
          unitMappingId: 'unit-map-2',
        },
      ],
      unitMappings: [
        {
          id: 'unit-map-2',
          mealieUnitId: 'unit-9',
          mealieUnitName: 'Pack',
          grocyUnitId: 19,
          grocyUnitName: 'Pack',
        },
      ],
      mealieFoods: [
        { id: 'food-2', name: 'Rice' },
        { id: 'food-3', name: 'Salt' },
      ],
      mealieUnits: [],
      grocyProducts: [
        { id: 101, name: 'Milk' },
        { id: 103, name: 'Salt' },
      ],
      grocyUnits: [
        { id: 19, name: 'Pack' },
      ],
    });

    expect(conflicts).toEqual([
      expect.objectContaining({
        type: 'missing_mealie_unit',
        mappingKind: 'unit',
        mappingId: 'unit-map-2',
        sourceTab: 'units',
        mealieId: 'unit-9',
        grocyId: 19,
      }),
      expect.objectContaining({
        type: 'missing_mealie_food',
        mappingKind: 'product',
        mappingId: 'product-map-1',
        sourceTab: 'products',
        mealieId: 'food-1',
        grocyId: 101,
      }),
      expect.objectContaining({
        type: 'missing_grocy_product',
        mappingKind: 'product',
        mappingId: 'product-map-2',
        sourceTab: 'products',
        mealieId: 'food-2',
        grocyId: 102,
      }),
      expect.objectContaining({
        type: 'broken_product_unit_reference',
        mappingKind: 'product',
        mappingId: 'product-map-3',
        sourceTab: 'units',
        mealieId: 'food-3',
        grocyId: 103,
      }),
    ]);
  });
});

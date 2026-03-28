import { describe, expect, it, vi } from 'vitest';
import {
  removeProductMapping,
  removeUnitMapping,
  upsertProductMapping,
  upsertUnitMapping,
} from '../manage';

describe('mapping management use-cases', () => {
  it('upserts a product mapping and renames the Grocy product to the Mealie name', async () => {
    const updateGrocyProduct = vi.fn(async () => undefined);
    const upsertStoredProductMapping = vi.fn(async () => 'map-1');

    const result = await upsertProductMapping(
      {
        mealieFoodId: 'food-1',
        grocyProductId: 101,
        grocyUnitId: 10,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        listProductMappings: vi.fn(async () => []),
        listUnitMappings: vi.fn(async () => [{
          id: 'unit-map-1',
          mealieUnitId: 'unit-1',
          mealieUnitName: 'Liter',
          mealieUnitAbbreviation: 'l',
          grocyUnitId: 10,
          grocyUnitName: 'Litre',
          conversionFactor: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        }]),
        getMealieFood: vi.fn(async () => ({ id: 'food-1', name: 'Whole Milk' })),
        getGrocyProduct: vi.fn(async () => ({ id: 101, name: 'Milk' })),
        updateGrocyProduct,
        upsertStoredProductMapping,
      },
    );

    expect(updateGrocyProduct).toHaveBeenCalledWith(101, { name: 'Whole Milk' });
    expect(upsertStoredProductMapping).toHaveBeenCalledWith({
      mappingId: undefined,
      mealieFoodId: 'food-1',
      mealieFoodName: 'Whole Milk',
      grocyProductId: 101,
      grocyProductName: 'Whole Milk',
      unitMappingId: 'unit-map-1',
    });
    expect(result).toEqual({
      mappingId: 'map-1',
      mealieFoodId: 'food-1',
      mealieFoodName: 'Whole Milk',
      grocyProductId: 101,
      grocyProductName: 'Whole Milk',
      unitMappingId: 'unit-map-1',
      renamedGrocyProduct: true,
    });
  });

  it('rejects a product mapping when the Grocy product already belongs to another Mealie food', async () => {
    await expect(upsertProductMapping(
      {
        mealieFoodId: 'food-1',
        grocyProductId: 101,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        listProductMappings: vi.fn(async () => [{
          id: 'map-2',
          mealieFoodId: 'food-2',
          mealieFoodName: 'Skim Milk',
          grocyProductId: 101,
          grocyProductName: 'Milk',
          unitMappingId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }]),
        listUnitMappings: vi.fn(async () => []),
        getMealieFood: vi.fn(async () => ({ id: 'food-1', name: 'Whole Milk' })),
        getGrocyProduct: vi.fn(async () => ({ id: 101, name: 'Milk' })),
        updateGrocyProduct: vi.fn(async () => undefined),
        upsertStoredProductMapping: vi.fn(async () => 'map-1'),
      },
    )).rejects.toThrow('Grocy product "Milk" (#101) is already mapped to Mealie food "Skim Milk".');
  });

  it('removes a product mapping and clears open conflicts for it', async () => {
    const deleteStoredProductMapping = vi.fn(async () => undefined);
    const resolveConflictsForMapping = vi.fn(async () => undefined);

    const result = await removeProductMapping(
      { mappingId: 'map-1' },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getStoredProductMapping: vi.fn(async () => ({ id: 'map-1' })),
        deleteStoredProductMapping,
        resolveConflictsForMapping,
      },
    );

    expect(deleteStoredProductMapping).toHaveBeenCalledWith('map-1');
    expect(resolveConflictsForMapping).toHaveBeenCalledWith('product', 'map-1');
    expect(result).toEqual({ removed: true, mappingId: 'map-1' });
  });

  it('upserts a unit mapping and renames the Grocy unit to the Mealie name', async () => {
    const updateGrocyUnit = vi.fn(async () => undefined);
    const upsertStoredUnitMapping = vi.fn(async () => 'unit-map-1');

    const result = await upsertUnitMapping(
      {
        mealieUnitId: 'unit-1',
        grocyUnitId: 10,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        listUnitMappings: vi.fn(async () => []),
        getMealieUnit: vi.fn(async () => ({
          id: 'unit-1',
          name: 'Liter',
          abbreviation: 'l',
          pluralName: 'Liters',
        })),
        getGrocyUnit: vi.fn(async () => ({
          id: 10,
          name: 'Litre',
        })),
        updateGrocyUnit,
        upsertStoredUnitMapping,
      },
    );

    expect(updateGrocyUnit).toHaveBeenCalledWith(10, {
      name: 'Liter',
      name_plural: 'Liters',
    });
    expect(result).toEqual({
      mappingId: 'unit-map-1',
      mealieUnitId: 'unit-1',
      mealieUnitName: 'Liter',
      grocyUnitId: 10,
      grocyUnitName: 'Liter',
      renamedGrocyUnit: true,
    });
  });

  it('removes a unit mapping and clears open conflicts for it', async () => {
    const deleteStoredUnitMapping = vi.fn(async () => undefined);
    const resolveConflictsForMapping = vi.fn(async () => undefined);

    const result = await removeUnitMapping(
      { mappingId: 'unit-map-1' },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getStoredUnitMapping: vi.fn(async () => ({ id: 'unit-map-1' })),
        deleteStoredUnitMapping,
        resolveConflictsForMapping,
      },
    );

    expect(deleteStoredUnitMapping).toHaveBeenCalledWith('unit-map-1');
    expect(resolveConflictsForMapping).toHaveBeenCalledWith('unit', 'unit-map-1');
    expect(result).toEqual({ removed: true, mappingId: 'unit-map-1' });
  });
});

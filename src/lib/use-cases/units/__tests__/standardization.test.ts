import { describe, expect, it, vi } from 'vitest';
import { createMealieUnit, getUnitCatalog, updateMealieUnitMetadata } from '../manage';

const lock = { acquireSyncLock: () => true, releaseSyncLock: vi.fn() };
describe('Mealie unit standardization', () => {
  it('reads a Grocy-only catalog without contacting Mealie', async () => {
    const listMealieUnits = vi.fn(async () => { throw new Error('Mealie offline'); });
    const result = await getUnitCatalog({ listGrocyUnits: async () => [{ id: 1, name: 'Gram' }], listMealieUnits, listUnitMappings: async () => [] }, 'grocy');
    expect(result.grocyUnits).toHaveLength(1);
    expect(result.mealieUnits).toEqual([]);
    expect(listMealieUnits).not.toHaveBeenCalled();
  });
  it('preserves native conversion fields when editing unrelated metadata', async () => {
    const updateMealieUnit = vi.fn(async () => {});
    await updateMealieUnitMetadata({ mealieUnitId: 'unit-1', abbreviation: 'kg' }, {
      ...lock, getMealieUnit: async () => ({ id: 'unit-1', name: 'Kilogram', standardQuantity: 1000, standardUnit: 'gram' }), updateMealieUnit,
    });
    expect(updateMealieUnit).toHaveBeenCalledWith('unit-1', expect.objectContaining({ standardQuantity: 1000, standardUnit: 'gram', abbreviation: 'kg' }));
  });
  it('writes and clears paired standardization fields', async () => {
    const updateMealieUnit = vi.fn(async () => {});
    const deps = { ...lock, getMealieUnit: async () => ({ id: 'unit-1', name: 'Kilogram', standardQuantity: 1, standardUnit: 'kilogram' }), updateMealieUnit };
    await updateMealieUnitMetadata({ mealieUnitId: 'unit-1', standardQuantity: 1000, standardUnit: 'gram' }, deps);
    expect(updateMealieUnit).toHaveBeenLastCalledWith('unit-1', expect.objectContaining({ standardQuantity: 1000, standardUnit: 'gram' }));
    await updateMealieUnitMetadata({ mealieUnitId: 'unit-1', standardQuantity: null, standardUnit: null }, deps);
    expect(updateMealieUnit).toHaveBeenLastCalledWith('unit-1', expect.objectContaining({ standardQuantity: null, standardUnit: null }));
  });
  it('rejects incomplete standard definitions before mutation', async () => {
    const create = vi.fn(async () => ({ id: 'new', name: 'Unit' }));
    await expect(createMealieUnit({ name: 'Unit', standardQuantity: 1000 }, { ...lock, listMealieUnits: async () => [], createMealieUnit: create })).rejects.toThrow('together');
    expect(create).not.toHaveBeenCalled();
  });
});

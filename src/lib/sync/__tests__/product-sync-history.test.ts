import { beforeEach, describe, expect, it, vi } from 'vitest';
import { productMappings, unitMappings } from '../../db/schema';

const mocks = vi.hoisted(() => ({
  units: vi.fn(), foods: vi.fn(), entities: vi.fn(), create: vi.fn(), insert: vi.fn(),
}));
vi.mock('../../db', () => ({
  db: {
    select: () => ({ from: () => Object.assign(Promise.resolve([]), { where: () => Promise.resolve([]) }) }),
    insert: (table: unknown) => ({ values: (value: unknown) => mocks.insert(table, value) }),
  },
}));
vi.mock('../../grocy/types', () => ({ getGrocyEntities: mocks.entities, createGrocyEntity: mocks.create }));
vi.mock('../../mealie', () => ({
  RecipesUnitsService: { getAllApiUnitsGet: mocks.units },
  RecipesFoodsService: { getAllApiFoodsGet: mocks.foods },
}));
vi.mock('../../settings', () => ({
  resolveAutoCreateUnits: async () => true, resolveAutoCreateProducts: async () => true,
  resolveDefaultUnit: async () => ({ unitMappingId: 'unit-map', grocyUnitId: 7 }),
}));
vi.mock('../../logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { runFullProductSync } from '../product-sync';

describe('product sync activity', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.units.mockResolvedValue({ items: [] });
    mocks.foods.mockResolvedValue({ items: [] });
    mocks.entities.mockImplementation(async (type: string) => type === 'products' ? [{ id: 101, name: 'Milk', qu_id_purchase: 7 }] : []);
    mocks.insert.mockResolvedValue(undefined);
  });

  it('records product mapping changes by name and records no changes on an empty sync', async () => {
    mocks.foods.mockResolvedValue({ items: [{ id: 'food-1', name: 'Milk' }] });
    const result = await runFullProductSync();
    expect(result.status).toBe('ok');
    expect(mocks.insert).toHaveBeenCalledWith(productMappings, expect.objectContaining({ grocyProductId: 101 }));
    expect(result.events).toEqual([expect.objectContaining({ kind: 'mutation', productName: 'Milk', category: 'mapping' })]);
    mocks.foods.mockResolvedValue({ items: [] });
    expect((await runFullProductSync()).events).toEqual([]);
  });

  it('preserves unit creation and mapping if fetching products fails afterwards', async () => {
    mocks.units.mockResolvedValue({ items: [{ id: 'unit-1', name: 'Bottle' }] });
    mocks.create.mockResolvedValue({ created_object_id: 7 });
    mocks.foods.mockRejectedValue(new Error('Mealie foods unavailable'));
    const result = await runFullProductSync();
    expect(result.status).toBe('partial');
    expect(mocks.insert).toHaveBeenCalledWith(unitMappings, expect.objectContaining({ grocyUnitId: 7 }));
    expect(result.events?.map(event => event.kind)).toEqual(['mutation', 'mutation', 'issue']);
    expect(result.events?.[2].message).toContain('Mealie foods unavailable');
  });

  it('preserves a created unit if its mapping cannot be saved', async () => {
    mocks.units.mockResolvedValue({ items: [{ id: 'unit-1', name: 'Bottle' }] });
    mocks.create.mockResolvedValue({ created_object_id: 7 });
    mocks.insert.mockRejectedValue(new Error('Mapping write failed'));
    const result = await runFullProductSync();
    expect(result.status).toBe('partial');
    expect(result.events?.map(event => event.kind)).toEqual(['mutation', 'issue']);
    expect(result.events?.[0].message).toBe('Created Grocy unit "Bottle".');
  });
});

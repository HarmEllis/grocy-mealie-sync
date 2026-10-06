import { beforeEach, describe, expect, it, vi } from 'vitest';

const upstream = vi.hoisted(() => ({
  products: [{ id: 1, name: 'Milk', qu_id_stock: 10 }],
  units: [{ id: 10, name: 'Liter' }],
}));
vi.mock('@/lib/db', async () => {
  const { createTestDb } = await import('@/test-utils/test-db');
  return { db: createTestDb() };
});
vi.mock('@/lib/grocy/types', () => ({
  getGrocyEntities: vi.fn(async (entity: string) => entity === 'products' ? upstream.products : upstream.units),
}));
vi.mock('@/lib/mealie', () => ({ RecipesFoodsService: {}, RecipesUnitsService: {} }));

import { db } from '@/lib/db';
import { retailerMappings, retailerProducts, retailerSuggestions } from '@/lib/db/schema';
import { generateSuggestions, listSuggestions, upsertRetailerProducts } from '@/lib/shop/retailer-catalog';
import { emptyUnitContext, mappingBaseUnitValid } from '@/lib/shop/units';
import { PATCH } from '../../mappings/[id]/route';
import { POST } from './route';

beforeEach(() => {
  for (const table of [retailerMappings, retailerSuggestions, retailerProducts]) db.delete(table).run();
  upstream.products = [{ id: 1, name: 'Milk', qu_id_stock: 10 }];
  upsertRetailerProducts('demo', [{ id: 'milk', name: 'Milk', packageAmount: 1, packageUnit: 'l', measure: 'unit' }]);
  generateSuggestions('demo', [{ targetKind: 'grocy_product', targetId: '1', targetName: 'Milk' }]);
});

const request = (body: unknown) => new Request('http://localhost/api/shop/suggestions/id', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe('suggestion acceptance', () => {
  it.each([
    { action: 'accept' },
    { action: 'accept', baseUnitId: 'old-unit', baseUnitName: 'Old unit' },
  ])('uses the current stock unit before confirming the UI suggestion: %j', async body => {
    const suggestion = listSuggestions()[0];
    const response = await POST(request(body), { params: Promise.resolve({ id: suggestion.id }) });
    expect(response.status).toBe(200);
    const { mapping } = await response.json();
    expect(mapping).toMatchObject({ packageBaseUnitId: '10', packageBaseUnitName: 'Liter', packageBaseAmount: 1, confirmed: false });

    const confirmed = await PATCH(request({ packageBaseAmount: 1 }), { params: Promise.resolve({ id: mapping.id }) });
    const saved = (await confirmed.json()).mapping;
    expect(saved.confirmed).toBe(true);
    const ctx = emptyUnitContext();
    ctx.grocyProducts.set(1, { id: 1, name: 'Milk', quIdStock: 10, quIdPurchase: 10, parentProductId: null, noOwnStock: false });
    expect(mappingBaseUnitValid(ctx, saved)).toBe(true);
  });

  it('keeps a suggestion pending when its Grocy target disappeared', async () => {
    upstream.products = [];
    const suggestion = listSuggestions()[0];
    const response = await POST(request({ action: 'accept' }), { params: Promise.resolve({ id: suggestion.id }) });
    expect(response.status).toBe(409);
    expect(listSuggestions()[0].status).toBe('pending');
    expect(db.select().from(retailerMappings).all()).toEqual([]);
  });
});

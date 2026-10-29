import { beforeEach, describe, expect, it, vi } from 'vitest';

const upstream = vi.hoisted(() => ({
  products: [{ id: 1, name: 'Milk', qu_id_stock: 10 }, { id: 2, name: 'Bread', qu_id_stock: 10 }, { id: 3, name: 'Eggs', qu_id_stock: 10 }],
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
import { upsertRetailerProducts } from '@/lib/shop/retailer-catalog';
import { POST } from './route';

function suggest(id: string, retailerProductId: string, targetId: string, targetName: string, score: number) {
  db.insert(retailerSuggestions).values({ id, providerId: 'demo', retailerProductId, targetKind: 'grocy_product', targetId, targetName, score, status: 'pending', createdAt: new Date() }).run();
}
const post = (body: unknown = {}) => POST(new Request('http://localhost/api/shop/suggestions/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));

beforeEach(() => {
  for (const table of [retailerMappings, retailerSuggestions, retailerProducts]) db.delete(table).run();
  upstream.products = [{ id: 1, name: 'Milk', qu_id_stock: 10 }, { id: 2, name: 'Bread', qu_id_stock: 10 }, { id: 3, name: 'Eggs', qu_id_stock: 10 }];
  upsertRetailerProducts('demo', ['milk', 'bread', 'eggs', 'butter'].map(id => ({ id, name: id, measure: 'unit' as const })));
});

describe('bulk suggestion acceptance', () => {
  it('accepts only suggestions above the score and leaves the mappings unconfirmed', async () => {
    suggest('s1', 'milk', '1', 'Milk', 0.97);
    suggest('s2', 'bread', '2', 'Bread', 0.86);
    suggest('s3', 'eggs', '3', 'Eggs', 0.85); // displayed as 85%, not above it
    suggest('s4', 'butter', '1', 'Milk', 0.4);
    const response = await post();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.accepted.map((item: { id: string }) => item.id)).toEqual(['s1', 's2']);
    expect(body.skipped).toEqual([]);
    const mappings = db.select().from(retailerMappings).all();
    expect(mappings.map(mapping => mapping.retailerProductId).sort()).toEqual(['bread', 'milk']);
    expect(mappings.every(mapping => mapping.confirmed === false && mapping.packageBaseUnitId === '10')).toBe(true);
    const statuses = Object.fromEntries(db.select().from(retailerSuggestions).all().map(row => [row.id, row.status]));
    expect(statuses).toMatchObject({ s1: 'accepted', s2: 'accepted', s3: 'pending', s4: 'pending' });
  });

  it('honours a custom threshold', async () => {
    suggest('s1', 'milk', '1', 'Milk', 0.97);
    suggest('s3', 'eggs', '3', 'Eggs', 0.85);
    const body = await (await post({ minScore: 0.8 })).json();
    expect(body.accepted.map((item: { id: string }) => item.id)).toEqual(['s1', 's3']);
  });

  it('skips a conflicting suggestion with its reason and still saves the others', async () => {
    suggest('s1', 'milk', '1', 'Milk', 0.97);
    suggest('s2', 'bread', '2', 'Bread', 0.95);
    upstream.products = upstream.products.filter(product => product.id !== 2);
    const body = await (await post()).json();
    expect(body.accepted.map((item: { id: string }) => item.id)).toEqual(['s1']);
    expect(body.skipped).toEqual([expect.objectContaining({ id: 's2', retailerProductId: 'bread', reason: expect.stringContaining('no longer available') })]);
    expect(db.select().from(retailerSuggestions).all().find(row => row.id === 's2')?.status).toBe('pending');
  });

  it('never displaces an existing preferred product of the same target', async () => {
    db.insert(retailerMappings).values({ id: 'm-existing', providerId: 'demo', retailerProductId: 'butter', retailerProductName: 'butter', targetKind: 'grocy_product', targetId: '1', targetName: 'Milk', role: 'preferred', packageBaseAmount: 1, packageBaseUnitId: '10', packageBaseUnitName: 'Liter', packageSource: 'user', confirmed: true, fulfilsAllDemand: false, createdAt: new Date(), updatedAt: new Date() }).run();
    suggest('s1', 'milk', '1', 'Milk', 0.97);
    const body = await (await post()).json();
    expect(body.accepted).toEqual([]);
    expect(body.skipped).toEqual([expect.objectContaining({ id: 's1', reason: expect.stringContaining('already has a preferred') })]);
    const rows = db.select().from(retailerMappings).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ retailerProductId: 'butter', role: 'preferred', confirmed: true });
    expect(db.select().from(retailerSuggestions).all()[0].status).toBe('pending');
  });

  it('keeps the highest scoring suggestion preferred when several target the same product', async () => {
    suggest('s1', 'milk', '1', 'Milk', 0.98);
    suggest('s2', 'butter', '1', 'Milk', 0.88);
    const body = await (await post()).json();
    expect(body.accepted.map((item: { id: string }) => item.id)).toEqual(['s1']);
    expect(body.skipped.map((item: { id: string }) => item.id)).toEqual(['s2']);
    expect(db.select().from(retailerMappings).all().map(row => [row.retailerProductId, row.role])).toEqual([['milk', 'preferred']]);
  });

  it('reports an empty batch and validates the body', async () => {
    expect(await (await post()).json()).toEqual({ accepted: [], skipped: [] });
    expect((await post({ minScore: 1.5 })).status).toBe(400);
    expect((await post({ unknown: true })).status).toBe(400);
  });
});

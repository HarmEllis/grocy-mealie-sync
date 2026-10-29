import { beforeEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ foods: [{ id: 'f1', name: 'Kipfilet' }, { id: 'f2', name: 'Aardappel' }], pages: 1, error: false }));
vi.mock('@/lib/db', async () => { const { createTestDb } = await import('@/test-utils/test-db'); return { db: createTestDb() }; });
vi.mock('@/lib/grocy/types', () => ({ getGrocyEntities: vi.fn(async (type: string) => type === 'products' ? [{ id: 1, name: 'Chicken breast', qu_id_stock: 10 }, { id: 2, name: 'Unlinked', qu_id_stock: 10 }] : [{ id: 10, name: 'gram' }]) }));
vi.mock('@/lib/mealie', () => ({ RecipesFoodsService: { getAllApiFoodsGet: vi.fn(async (...args) => { if (fixture.error) throw new Error('Unavailable'); return { items: fixture.pages === 1 ? fixture.foods : args[6] === 1 ? fixture.foods.slice(0, 1) : fixture.foods.slice(1), total_pages: fixture.pages }; }) }, RecipesUnitsService: { getAllApiUnitsGet: vi.fn(async () => ({ items: [{ id: 'grams', name: 'gram' }], total_pages: 1 })) } }));
import { db } from '@/lib/db';
import { productMappings, retailerMappings, retailerProducts } from '@/lib/db/schema';
import { productInventory, clearProductInventoryCache } from '../product-inventory';
import { GET } from '@/app/api/shop/products/route';
beforeEach(() => {
  fixture.pages = 1; fixture.error = false; clearProductInventoryCache();
  db.delete(productMappings).run(); db.delete(retailerMappings).run(); db.delete(retailerProducts).run();
  db.insert(productMappings).values({ id: 'mapping', createdAt: new Date(), updatedAt: new Date(), grocyProductId: 1, grocyProductName: 'Chicken breast', mealieFoodId: 'f1', mealieFoodName: 'Kipfilet' }).run();
});
it('collapses linked products and searches by either name before slicing the canonical table', async () => {
  const result = await productInventory({ limit: 1 });
  expect(result.total).toBe(3);
  expect(result.targets).toEqual([expect.objectContaining({ kind: 'grocy_product', id: '1', source: 'grocy_mealie', baseUnitId: '10', baseUnitName: 'gram', linkedFoods: [{ id: 'f1', name: 'Kipfilet' }] })]);
  expect((await productInventory({ query: 'kipfilet' })).targets.map(target => target.id)).toEqual(['1']);
  expect((await productInventory({ source: 'mealie' })).targets.map(target => target.id)).toEqual(['f2']);
  expect((await productInventory({ source: 'grocy' })).targets.map(target => target.id)).toEqual(['2']);
  expect((await productInventory({ offset: 2, limit: 1 })).targets.map(target => target.id)).toEqual(['f2']);
});
it('includes Mealie foods on later upstream pages and does not mark missing upstream data as empty success', async () => {
  fixture.pages = 2;
  expect((await productInventory({ source: 'mealie' })).targets.map(target => target.id)).toEqual(['f2']);
  fixture.error = true;
  expect((await GET(new Request('http://test/api/shop/products'))).status).toBeGreaterThanOrEqual(400);
});
it('filters by preferred mapping, provider and explicit Mealie units; alternatives alone do not count as mapped', async () => {
  const values = { id: 'r1', providerId: 'ah', retailerProductId: 'shop1', retailerProductName: 'Potatoes', targetKind: 'mealie_food', targetId: 'f2', targetName: 'Aardappel', role: 'preferred', packageBaseUnitId: 'grams', packageBaseUnitName: 'gram', packageBaseAmount: 500, confirmed: true, createdAt: new Date(), updatedAt: new Date() };
  db.insert(retailerMappings).values(values).run();
  const result = await productInventory({ mapped: 'mapped' });
  expect(result.targets).toEqual([expect.objectContaining({ id: 'f2', baseUnitId: 'grams', baseUnitName: 'gram' })]);
  expect((await productInventory({ mapped: 'mapped', providerId: 'picnic' })).total).toBe(0);
  db.insert(retailerMappings).values({ ...values, id: 'r2', providerId: 'picnic', retailerProductId: 'shop2', role: 'alternative', packageBaseUnitId: null, packageBaseUnitName: null }).run();
  expect((await productInventory({ source: 'mealie' })).targets[0].baseUnitName).toBe('Different units per shop');
  expect((await productInventory({ mapped: 'unmapped' })).targets.map(target => target.id)).toEqual(['1', '2']);
});
it('validates pagination and filters at the shared UI/MCP handler boundary', async () => {
  for (const query of ['limit=201', 'offset=-1', 'source=unknown', 'arbitrary=1']) {
    expect((await GET(new Request(`http://test/api/shop/products?${query}`))).status).toBe(400);
  }
});
it('exposes the same canonical filters and numeric pagination through a real MCP tool call', async () => {
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
  const { registerShopTools } = await import('@/mcp/tools/shop');
  const server = new McpServer({ name: 'inventory-test', version: 'test' });
  registerShopTools(server);
  const client = new Client({ name: 'test', version: 'test' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  try {
    const result = await client.callTool({ name: 'shop.products.list', arguments: { source: 'all', offset: 1, limit: 1 } });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: true, data: { offset: 1, total: 3, targets: [{ id: '2', source: 'grocy' }] } });
    const linked = await client.callTool({ name: 'shop.products.list', arguments: { query: 'Kipfilet', source: 'grocy_mealie' } });
    expect(linked.structuredContent).toMatchObject({ data: { targets: [{ id: '1', linkedFoods: [{ id: 'f1' }] }] } });
  } finally { await client.close(); await server.close(); }
});
it('includes legacy mappings to linked Mealie foods in the canonical Grocy row without changing their units', async () => {
  db.insert(retailerMappings).values({ id: 'legacy', providerId: 'ah', retailerProductId: 'shop1', retailerProductName: 'Chicken', targetKind: 'mealie_food', targetId: 'f1', targetName: 'Kipfilet', role: 'preferred', packageBaseUnitId: 'grams', packageBaseUnitName: 'gram', packageBaseAmount: 500, confirmed: true, createdAt: new Date(), updatedAt: new Date() }).run();
  const inventory = await productInventory({ mapped: 'mapped', providerId: 'ah' });
  expect(inventory.targets.map(target => target.id)).toEqual(['1']);
  expect(inventory.targets[0].baseUnitId).toBe('10');
  expect(db.select().from(retailerMappings).all()[0].targetKind).toBe('mealie_food');
});
it('shares metadata across filtered API calls, while explicit refresh and new mappings remain observable', async () => {
  const { RecipesFoodsService } = await import('@/lib/mealie');
  vi.mocked(RecipesFoodsService.getAllApiFoodsGet).mockClear();
  expect((await GET(new Request('http://test/api/shop/products?limit=1'))).status).toBe(200);
  expect((await GET(new Request('http://test/api/shop/products?source=mealie'))).status).toBe(200);
  expect(RecipesFoodsService.getAllApiFoodsGet).toHaveBeenCalledTimes(1);
  db.insert(retailerMappings).values({ id: 'cache-mapping', providerId: 'ah', retailerProductId: 'shop1', retailerProductName: 'Chicken', targetKind: 'grocy_product', targetId: '1', targetName: 'Chicken breast', role: 'preferred', createdAt: new Date(), updatedAt: new Date() }).run();
  const mapped = await (await GET(new Request('http://test/api/shop/products?mapped=mapped'))).json();
  expect(mapped.targets.map((target: { id: string }) => target.id)).toEqual(['1']);
  await GET(new Request('http://test/api/shop/products?refresh=true'));
  expect(RecipesFoodsService.getAllApiFoodsGet).toHaveBeenCalledTimes(2);
});

const mapping = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, providerId: 'ah', retailerProductId: `shop-${id}`, retailerProductName: `Shop ${id}`, targetKind: 'grocy_product', targetId: '1', targetName: 'Chicken breast',
  role: 'preferred', packageBaseAmount: 500, packageBaseUnitId: '10', packageBaseUnitName: 'gram', packageSource: 'user', confirmed: true, fulfilsAllDemand: false,
  createdAt: new Date(), updatedAt: new Date(), ...overrides,
});
const product = (externalId: string, availability: string, providerId = 'ah') => ({
  id: `${providerId}:${externalId}`, providerId, externalId, name: externalId, measure: 'unit', availability, lastSeenAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
});

it('lists no attention reasons for a healthy mapping and counts it as mapped only', async () => {
  db.insert(retailerMappings).values(mapping('ok')).run();
  const result = await productInventory({});
  expect(result.targets.find(target => target.id === '1')).toMatchObject({ attention: [], mappedProviders: ['ah'] });
  expect(result.targets.find(target => target.id === '2')).toMatchObject({ attention: [], mappedProviders: [] });
  expect(result.counts).toMatchObject({ mapped: 1, unmapped: 2, attention: 0 });
  expect((await productInventory({ attention: 'any' })).total).toBe(0);
});

it('flags a moved stock unit, an unconfirmed amount and a discontinued retailer product independently of mapped', async () => {
  db.insert(retailerMappings).values(mapping('moved', { packageBaseUnitId: '99' })).run();
  db.insert(retailerMappings).values(mapping('open', { providerId: 'picnic', confirmed: false })).run();
  db.insert(retailerMappings).values(mapping('gone', { providerId: 'jumbo', targetKind: 'grocy_product', targetId: '2', targetName: 'Unlinked' })).run();
  db.insert(retailerProducts).values(product('shop-gone', 'discontinued', 'jumbo')).run();
  const all = await productInventory({});
  expect(all.targets.find(target => target.id === '1')).toMatchObject({ attention: ['unit_changed', 'unconfirmed'], mappedProviders: ['ah', 'picnic'] });
  expect(all.targets.find(target => target.id === '2')).toMatchObject({ attention: ['discontinued'], mappedProviders: ['jumbo'] });
  expect(all.counts).toMatchObject({ mapped: 2, attention: 2 });
  expect((await productInventory({ attention: 'any' })).targets.map(target => target.id)).toEqual(['1', '2']);
  expect((await productInventory({ attention: 'unit_changed' })).targets.map(target => target.id)).toEqual(['1']);
  expect((await productInventory({ attention: 'unconfirmed' })).targets.map(target => target.id)).toEqual(['1']);
  expect((await productInventory({ attention: 'discontinued' })).targets.map(target => target.id)).toEqual(['2']);
  // attention and mapped narrow independently, and the total stays correct for pagination.
  expect((await productInventory({ attention: 'any', mapped: 'mapped', limit: 1 })).total).toBe(2);
  expect((await productInventory({ attention: 'any', mapped: 'unmapped' })).total).toBe(0);
  expect((await productInventory({ attention: 'any', limit: 1, offset: 1 })).targets.map(target => target.id)).toEqual(['2']);
});

it('scopes attention to the selected provider and ignores alternatives', async () => {
  db.insert(retailerMappings).values(mapping('moved', { packageBaseUnitId: '99' })).run();
  db.insert(retailerMappings).values(mapping('alt', { providerId: 'picnic', role: 'alternative', confirmed: false })).run();
  expect((await productInventory({ attention: 'any', providerId: 'picnic' })).total).toBe(0);
  expect((await productInventory({ attention: 'any', providerId: 'ah' })).targets.map(target => target.id)).toEqual(['1']);
  expect((await productInventory({ attention: 'unconfirmed' })).total).toBe(0);
});

it('treats a preferred mapping that still points at the linked Mealie food as a changed unit', async () => {
  db.insert(retailerMappings).values(mapping('legacy', { targetKind: 'mealie_food', targetId: 'f1', targetName: 'Kipfilet', packageBaseUnitId: '10' })).run();
  const result = await productInventory({ attention: 'unit_changed' });
  expect(result.targets.map(target => target.id)).toEqual(['1']);
  expect(result.targets[0].attention).toEqual(['unit_changed']);
});

it('accepts the attention filter at the API boundary and rejects unknown values', async () => {
  db.insert(retailerMappings).values(mapping('open', { confirmed: false })).run();
  const response = await GET(new Request('http://test/api/shop/products?attention=unconfirmed'));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.targets.map((target: { id: string }) => target.id)).toEqual(['1']);
  expect(body.counts.attention).toBe(1);
  expect((await GET(new Request('http://test/api/shop/products?attention=bogus'))).status).toBe(400);
});

it('does not let a shadowed legacy mapping flag a product whose direct preferred mapping is healthy', async () => {
  db.insert(retailerMappings).values(mapping('direct')).run();
  db.insert(retailerMappings).values(mapping('legacy', { targetKind: 'mealie_food', targetId: 'f1', targetName: 'Kipfilet', confirmed: false, packageBaseUnitId: '77' })).run();
  const result = await productInventory({});
  expect(result.targets.find(target => target.id === '1')).toMatchObject({ attention: [], mappedProviders: ['ah'] });
  // Another provider with only the legacy mapping is still flagged.
  db.insert(retailerMappings).values(mapping('other', { providerId: 'picnic', targetKind: 'mealie_food', targetId: 'f1', targetName: 'Kipfilet' })).run();
  expect((await productInventory({})).targets.find(target => target.id === '1')?.attention).toEqual(['unit_changed']);
});

it('flags a Mealie food mapped to a unit that no longer exists, but not a count or an existing unit', async () => {
  const food = (id: string, unit: string | null) => mapping(id, { targetKind: 'mealie_food', targetId: 'f2', targetName: 'Aardappel', packageBaseUnitId: unit });
  db.insert(retailerMappings).values(food('gone', 'removed-unit')).run();
  expect((await productInventory({ source: 'mealie' })).targets[0].attention).toEqual(['unit_changed']);
  db.delete(retailerMappings).run();
  db.insert(retailerMappings).values(food('known', 'grams')).run();
  expect((await productInventory({ source: 'mealie' })).targets[0].attention).toEqual([]);
  db.delete(retailerMappings).run();
  db.insert(retailerMappings).values(food('count', null)).run();
  expect((await productInventory({ source: 'mealie' })).targets[0].attention).toEqual([]);
});

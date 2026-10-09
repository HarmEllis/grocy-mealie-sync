import { beforeEach, expect, it, vi } from 'vitest';
const mocked = vi.hoisted(() => ({ items: [] as unknown[], context: null as unknown }));
vi.mock('@/lib/db', async () => { const { createTestDb } = await import('@/test-utils/test-db'); return { db: createTestDb() }; });
vi.mock('@/lib/settings', () => ({ resolveShoppingListId: async () => 'list' }));
vi.mock('@/lib/sync/helpers', () => ({ fetchAllMealieShoppingItems: async () => mocked.items }));
vi.mock('../context', () => ({ loadUnitContext: async () => mocked.context }));
vi.mock('@/lib/plugins/runtime', () => ({ getPluginGateway: () => null, setShopWorker: vi.fn() }));
import { db } from '@/lib/db';
import { appMeta, demandRevisions, demands, pluginInstallations, retailerMappings, retailerProducts, retailerSuggestions, shopCatalogSearches, shopExportAllocations, shopExports } from '@/lib/db/schema';
import { createInstallation, recordHello, updateInstallationSettings } from '@/lib/plugins/installations';
import { emptyUnitContext } from '../units';
import { runShopDemandStep } from '../worker';
import { listCatalogSearches } from '../catalog-discovery';
import { upsertRetailerMapping, upsertRetailerProducts } from '../retailer-catalog';
import { shopOverview } from '../overview';

let installationId: string;
beforeEach(() => {
  for (const table of [appMeta, demands, demandRevisions, pluginInstallations, retailerMappings, retailerProducts, retailerSuggestions, shopCatalogSearches, shopExports, shopExportAllocations]) db.delete(table).run();
  const ctx = emptyUnitContext();
  ctx.foodToGrocyProduct.set('tomatoes', 1);
  ctx.grocyProducts.set(1, { id: 1, name: 'Cherry tomaten', quIdStock: 1, quIdPurchase: 1, parentProductId: null, noOwnStock: false });
  mocked.context = ctx;
  mocked.items = [{ id: 'row', shoppingListId: 'list', foodId: 'tomatoes', food: { name: 'Cherry tomaten' }, quantity: 1, checked: false }];
  installationId = createInstallation('AH household').installation.id;
  recordHello(installationId, { pluginName: 'AH', pluginVersion: 'test', providerId: 'ah', providerLabel: 'AH', accountKey: 'synthetic', accountLabel: 'Synthetic', protocolVersions: [1], capabilities: ['auth', 'catalog', 'list'], authState: 'authenticated' });
  updateInstallationSettings(installationId, { listSyncEnabled: true });
});

it('automatically queues newly observed ingredients, including Mealie-only names', async () => {
  mocked.items.push({ id: 'basil-row', shoppingListId: 'list', foodId: 'basil', food: { name: 'Basil' }, quantity: 1 });
  await runShopDemandStep();
  expect(listCatalogSearches('ah')).toEqual(expect.arrayContaining([
    expect.objectContaining({ targetKind: 'grocy_product', targetId: '1', query: 'Cherry tomaten' }),
    expect.objectContaining({ targetKind: 'mealie_food', targetId: 'basil', query: 'Basil' }),
  ]));
});

it('shows real row names and projection reasons without requiring a Grocy mapping', async () => {
  mocked.items.push({ id: 'basil-row', shoppingListId: 'list', foodId: 'basil', food: { name: 'Basil' }, quantity: 1 });
  db.insert(appMeta).values({ key: 'shop-demand-labels:list', value: '{broken' }).run();
  db.insert(appMeta).values({ key: `shop-projection-review:${installationId}`, value: '{broken' }).run();
  const observed = await runShopDemandStep();
  expect(observed.events).toEqual([]);
  expect(shopOverview().openDemand).toEqual(expect.arrayContaining([expect.objectContaining({ mealieItemId: 'basil-row', label: 'Basil' })]));
  expect(shopOverview().projectionReview).toEqual(expect.arrayContaining([
    expect.objectContaining({ installationId, mealieItemId: 'basil-row', label: 'Basil', reason: 'no_retailer_mapping' }),
  ]));
  upsertRetailerProducts('ah', [{ id: 'basil-product', name: 'AH Basil', measure: 'unit' }]);
  upsertRetailerMapping({ providerId: 'ah', retailerProductId: 'basil-product', targetKind: 'mealie_food', targetId: 'basil', targetName: 'Basil',
    role: 'preferred', baseUnitId: null, baseUnitName: null, packageBaseAmount: 1, confirm: true });
  await runShopDemandStep();
  expect(shopOverview().projectionReview.some(row => row.mealieItemId === 'basil-row')).toBe(false);
  mocked.items = [];
  await runShopDemandStep();
  expect(shopOverview().projectionReview).toEqual([]);
});

it('reports individual product plans and preserves preferred mapping through Mealie remove/re-add', async () => {
  await runShopDemandStep();
  upsertRetailerProducts('ah', [{ id: '123', name: 'AH Cherry tomaten', measure: 'unit' }]);
  upsertRetailerMapping({ providerId: 'ah', retailerProductId: '123', targetKind: 'grocy_product', targetId: '1', targetName: 'Cherry tomaten', role: 'preferred', baseUnitId: '1', baseUnitName: 'piece', packageBaseAmount: 1, confirm: true });
  const first = await runShopDemandStep();
  expect(first.events).toEqual([expect.objectContaining({ productName: 'AH Cherry tomaten', entityKind: 'product', message: expect.stringContaining('Prepared 1 package(s) of AH Cherry tomaten') })]);
  expect((await runShopDemandStep()).events).toEqual([]);
  mocked.items = [];
  expect((await runShopDemandStep()).events?.[0].message).toContain('Removed the demand for AH Cherry tomaten');
  mocked.items = [{ id: 'new-row', shoppingListId: 'list', foodId: 'tomatoes', quantity: 1, checked: false }];
  expect((await runShopDemandStep()).events?.[0].productName).toBe('AH Cherry tomaten');
  expect(listCatalogSearches('ah')).toEqual([]);
  expect(db.select().from(retailerMappings).all()).toHaveLength(1);
});

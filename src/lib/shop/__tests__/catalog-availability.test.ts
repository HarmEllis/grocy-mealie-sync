import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const upstream = vi.hoisted(() => ({
  products: [{ id: 1, name: 'Kipfilet', qu_id_stock: 3 }] as Array<Record<string, unknown>>,
  units: [{ id: 3, name: 'g' }, { id: 4, name: 'Stuk' }],
  mealieUnits: [{ id: 'm-gram', name: 'gram' }],
}));
vi.mock('@/lib/db', async () => {
  const { createTestDb } = await import('@/test-utils/test-db');
  return { db: createTestDb() };
});
vi.mock('@/lib/grocy/types', () => ({
  getGrocyEntities: vi.fn(async (entity: string) => entity === 'products' ? upstream.products : upstream.units),
}));
vi.mock('@/lib/mealie', () => ({
  RecipesFoodsService: {},
  RecipesUnitsService: { getAllApiUnitsGet: vi.fn(async () => ({ items: upstream.mealieUnits })) },
}));
vi.mock('@/lib/mealie/types', () => ({ extractUnits: (page: { items: unknown[] }) => page.items }));

import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { createInstallation, recordHello } from '@/lib/plugins/installations';
import type { PluginGateway } from '@/lib/plugins/gateway';
import type { HelloParams, RetailerProduct } from '@/lib/plugins/protocol/v1';
import { clearCatalogSearchCache, refreshCatalogProducts, searchCatalog } from '../catalog-service';
import { saveRetailerMapping, updateRetailerMapping } from '../mapping-save';
import { deleteRetailerMapping, getRetailerMapping, getRetailerProduct, upsertRetailerMapping, upsertRetailerProducts } from '../retailer-catalog';

const hello: HelloParams = {
  pluginName: 'Demo', pluginVersion: '1', providerId: 'demo-shop', providerLabel: 'Demo', accountKey: 'demo-account', accountLabel: null,
  protocolVersions: [1], capabilities: ['catalog'], authState: 'authenticated',
};

function installGateway(handlers: { search?: (query: string) => Promise<RetailerProduct[]>; get?: (ids: string[]) => Promise<RetailerProduct[]> }) {
  const call = vi.fn(async (_id: string, method: string, params: { query?: string; ids?: string[] }) => {
    if (method === 'catalog.search') return { products: await handlers.search!(params.query!) };
    if (method === 'catalog.get') return { products: await handlers.get!(params.ids!) };
    throw new Error(`unexpected ${method}`);
  });
  globalThis.__gmsPluginGateway = {
    getSession: () => ({ sessionId: 's', installationId: 'x', hello, connectedAt: new Date() }),
    listSessions: () => [],
    call,
  } as unknown as PluginGateway;
  return call;
}

function setup() {
  const { installation } = createInstallation('Demo');
  recordHello(installation.id, hello);
  return installation.id;
}

beforeEach(() => {
  for (const table of Object.values(schema)) {
    if (table && typeof table === 'object' && Symbol.for('drizzle:Name') in (table as object)) db.delete(table as typeof schema.receipts).run();
  }
  clearCatalogSearchCache();
  upstream.products = [{ id: 1, name: 'Kipfilet', qu_id_stock: 3 }];
});
afterEach(() => { globalThis.__gmsPluginGateway = undefined; });

const chicken = (overrides: Partial<RetailerProduct> = {}): RetailerProduct =>
  ({ id: 'chicken', name: 'AH Kipfilet', brand: 'AH', packageAmount: 500, packageUnit: 'g', measure: 'unit', ...overrides });

describe('persistent availability', () => {
  it('only changes with an explicit known statement and keeps package data on sparse rediscovery', () => {
    const t1 = new Date('2026-10-01T10:00:00Z');
    upsertRetailerProducts('demo-shop', [chicken({ availability: 'discontinued' })], t1);
    upsertRetailerProducts('demo-shop', [{ id: 'chicken', name: 'AH Kipfilet', measure: 'unit' }], new Date('2026-10-02T10:00:00Z'));
    upsertRetailerProducts('demo-shop', [chicken({ availability: 'unknown' })], new Date('2026-10-03T10:00:00Z'));
    expect(getRetailerProduct('demo-shop', 'chicken')).toMatchObject({ availability: 'discontinued', availabilityCheckedAt: t1, packageAmount: 500, brand: 'AH' });
    const t4 = new Date('2026-10-04T10:00:00Z');
    upsertRetailerProducts('demo-shop', [chicken({ availability: 'available' })], t4);
    expect(getRetailerProduct('demo-shop', 'chicken')).toMatchObject({ availability: 'available', availabilityCheckedAt: t4 });
  });

  it('defaults to unknown without a check timestamp', () => {
    upsertRetailerProducts('demo-shop', [chicken()]);
    expect(getRetailerProduct('demo-shop', 'chicken')).toMatchObject({ availability: 'unknown', availabilityCheckedAt: null });
  });
});

describe('catalogue search', () => {
  it('merges live results with saved matches, caches briefly and shares concurrent calls', async () => {
    const id = setup();
    upsertRetailerProducts('demo-shop', [chicken({ id: 'chicken-thigh', name: 'AH Kipdij', availability: 'discontinued' })]);
    let release!: () => void;
    const search = vi.fn(() => new Promise<RetailerProduct[]>(resolve => { release = () => resolve([chicken({ availability: 'available' })]); }));
    const call = installGateway({ search });
    const first = searchCatalog(id, 'kip');
    const second = searchCatalog(id, ' KIP ');
    await vi.waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    release();
    const [a, b] = await Promise.all([first, second]);
    expect(call).toHaveBeenCalledTimes(1);
    expect(a!.status).toBe('live');
    expect(a!.products.map(product => [product.id, product.live, product.availability])).toEqual([
      ['chicken', true, 'available'],
      ['chicken-thigh', false, 'discontinued'],
    ]);
    expect(a!.products[0]).toMatchObject({ packageAmount: 500, packageUnit: 'g', measure: 'unit', availabilityCheckedAt: expect.any(String) });
    expect(b!.products).toHaveLength(2);
    search.mockImplementation(async () => [chicken({ availability: 'available' })]);
    expect((await searchCatalog(id, 'kip'))!.status).toBe('cached');
    expect(call).toHaveBeenCalledTimes(1);
    await searchCatalog(id, 'kip', { refresh: true });
    expect(call).toHaveBeenCalledTimes(2);
    // Another retailer account (or session) never sees the previous account's cached results.
    hello.accountKey = 'other-account';
    try {
      expect((await searchCatalog(id, 'kip'))!.status).toBe('live');
      expect(call).toHaveBeenCalledTimes(3);
    } finally { hello.accountKey = 'demo-account'; }
  });

  it('returns saved products with an explicit offline status when the plugin is unavailable', async () => {
    const id = setup();
    upsertRetailerProducts('demo-shop', [chicken()]);
    const result = await searchCatalog(id, 'kipfilet');
    expect(result).toMatchObject({ status: 'offline', fetchedAt: null, message: expect.stringContaining('not connected') });
    expect(result!.products).toEqual([expect.objectContaining({ id: 'chicken', live: false, saved: true, availability: 'unknown' })]);
  });

  it('never marks a product discontinued because a refresh omitted it', async () => {
    setup();
    upsertRetailerProducts('demo-shop', [chicken({ availability: 'available' })], new Date('2026-10-01T00:00:00Z'));
    installGateway({ get: async () => [] });
    const result = await refreshCatalogProducts('demo-shop', ['chicken']);
    expect(result).toMatchObject({ status: 'refreshed', missing: ['chicken'] });
    expect(getRetailerProduct('demo-shop', 'chicken')?.availability).toBe('available');
  });
});

describe('validated mapping saves', () => {
  const input = {
    providerId: 'demo-shop', retailerProductId: 'chicken', targetKind: 'grocy_product' as const, targetId: '1', targetName: 'Kipfilet',
    role: 'preferred' as const, baseUnitId: '3', baseUnitName: 'g',
  };

  it('saves known products offline and reports the availability as unknown', async () => {
    setup();
    upsertRetailerProducts('demo-shop', [chicken()]);
    const result = await saveRetailerMapping({ ...input, confirm: true, packageBaseAmount: 500 });
    expect(result.mapping).toMatchObject({ confirmed: true, packageBaseAmount: 500, packageBaseUnitId: '3' });
    expect(result.availability).toMatchObject({ availability: 'unknown', refresh: 'offline' });
    expect(result.warnings).toEqual(['availability_unknown']);
  });

  it('refreshes stale availability first and refuses a new mapping for a discontinued product', async () => {
    setup();
    upsertRetailerProducts('demo-shop', [chicken({ availability: 'available' })], new Date('2026-01-01T00:00:00Z'));
    const call = installGateway({ get: async () => [chicken({ availability: 'discontinued' })] });
    await expect(saveRetailerMapping(input)).rejects.toMatchObject({ status: 409 });
    expect(call).toHaveBeenCalledWith(expect.any(String), 'catalog.get', { ids: ['chicken'] }, expect.anything());
    expect(getRetailerMapping('demo-shop', 'chicken')).toBeNull();
  });

  it('keeps existing mappings of discontinued products with a warning but refuses promotion', async () => {
    setup();
    upsertRetailerProducts('demo-shop', [chicken()]);
    upsertRetailerMapping({ ...input, role: 'alternative', packageBaseAmount: 500, confirm: true });
    upsertRetailerProducts('demo-shop', [chicken({ availability: 'discontinued' })]);
    const kept = await saveRetailerMapping({ ...input, role: 'alternative' });
    expect(kept.warnings).toContain('product_discontinued');
    expect(kept.mapping).toMatchObject({ confirmed: true, packageBaseAmount: 500 });
    await expect(saveRetailerMapping(input)).rejects.toMatchObject({ status: 409 });
    await expect(updateRetailerMapping(kept.mapping.id, { role: 'preferred' })).rejects.toMatchObject({ status: 409 });
    upstream.products.push({ id: 2, name: 'Kipdij', qu_id_stock: 3 });
    await expect(saveRetailerMapping({ ...input, role: 'alternative', targetId: '2', targetName: 'Kipdij' })).rejects.toMatchObject({ status: 409 });
    expect(getRetailerMapping('demo-shop', 'chicken')?.targetId).toBe('1');
    expect(getRetailerMapping('demo-shop', 'chicken')?.role).toBe('alternative');
  });

  it('uses the current Grocy stock unit and refuses to confirm an amount in a stale unit', async () => {
    setup();
    upsertRetailerProducts('demo-shop', [chicken()]);
    upstream.products = [{ id: 1, name: 'Kipfilet', qu_id_stock: 4 }];
    await expect(saveRetailerMapping({ ...input, packageBaseAmount: 500, confirm: true })).rejects.toMatchObject({ status: 409 });
    await expect(saveRetailerMapping({ ...input, confirm: true })).rejects.toMatchObject({ status: 409 });
    const replaced = await saveRetailerMapping(input);
    expect(replaced.mapping).toMatchObject({ packageBaseUnitId: '4', packageBaseUnitName: 'Stuk', confirmed: false });
    expect(replaced.warnings).toContain('base_unit_replaced');
    await expect(saveRetailerMapping({ ...input, baseUnitId: null, baseUnitName: null, confirm: true })).rejects.toMatchObject({ status: 409 });
  });

  it('refuses confirming an existing mapping whose stock unit changed', async () => {
    setup();
    upsertRetailerProducts('demo-shop', [chicken()]);
    const { mapping } = await saveRetailerMapping(input);
    upstream.products = [{ id: 1, name: 'Kipfilet', qu_id_stock: 4 }];
    await expect(updateRetailerMapping(mapping.id, { packageBaseAmount: 1 })).rejects.toMatchObject({ status: 409 });
    expect(getRetailerMapping('demo-shop', 'chicken')?.confirmed).toBe(false);
  });

  it('validates a supplied Mealie unit and allows counts', async () => {
    setup();
    upsertRetailerProducts('demo-shop', [chicken()]);
    const mealie = { ...input, targetKind: 'mealie_food' as const, targetId: 'food-1' };
    await expect(saveRetailerMapping({ ...mealie, baseUnitId: 'missing', baseUnitName: 'x' })).rejects.toMatchObject({ status: 409 });
    expect((await saveRetailerMapping({ ...mealie, baseUnitId: 'm-gram', baseUnitName: 'whatever', confirm: true, packageBaseAmount: 500 })).mapping)
      .toMatchObject({ packageBaseUnitId: 'm-gram', packageBaseUnitName: 'gram', confirmed: true, packageBaseAmount: 500 });
    expect((await saveRetailerMapping({ ...mealie, baseUnitId: null, baseUnitName: null })).mapping).toMatchObject({ packageBaseUnitId: null });
  });

  it('keeps an explicit confirmation when the same mapping is saved again', async () => {
    setup();
    upsertRetailerProducts('demo-shop', [chicken()]);
    await saveRetailerMapping({ ...input, packageBaseAmount: 450, confirm: true });
    const again = await saveRetailerMapping({ ...input, role: 'alternative' });
    expect(again.mapping).toMatchObject({ role: 'alternative', confirmed: true, packageBaseAmount: 450, packageSource: 'confirmed' });
  });
  it('requires an echoed amount and expected Grocy unit even when derivation is exact', async () => {
    setup(); upsertRetailerProducts('demo-shop', [chicken()]);
    await expect(saveRetailerMapping({ ...input, confirm: true })).rejects.toMatchObject({ status: 409 });
    await expect(saveRetailerMapping({ ...input, baseUnitId: null, packageBaseAmount: 500, confirm: true })).rejects.toMatchObject({ status: 409 });
    expect(getRetailerMapping('demo-shop', 'chicken')).toBeNull();
  });

  it('requires explicit reassignment except for a linked Mealie-to-Grocy canonical move', async () => {
    setup(); upsertRetailerProducts('demo-shop', [chicken()]);
    upstream.products.push({ id: 2, name: 'Kipdij', qu_id_stock: 3 });
    await saveRetailerMapping(input);
    await expect(saveRetailerMapping({ ...input, targetId: '2' })).rejects.toMatchObject({ status: 409 });
    expect((await saveRetailerMapping({ ...input, targetId: '2', reassign: true })).mapping.targetId).toBe('2');
    deleteRetailerMapping(getRetailerMapping('demo-shop', 'chicken')!.id);
    db.insert(schema.productMappings).values({ id: 'linked', grocyProductId: 1, grocyProductName: 'Kipfilet', mealieFoodId: 'food-1', mealieFoodName: 'Kipfilet', createdAt: new Date(), updatedAt: new Date() }).run();
    upsertRetailerMapping({ ...input, targetKind: 'mealie_food', targetId: 'food-1' });
    expect((await saveRetailerMapping(input)).mapping.targetKind).toBe('grocy_product');
  });

  it('rejects an amount when a concurrent save changes the target during availability refresh', async () => {
    setup(); upsertRetailerProducts('demo-shop', [chicken()]);
    const { mapping } = await saveRetailerMapping(input);
    installGateway({ get: async () => {
      upsertRetailerMapping({ ...input, targetId: '2', baseUnitId: '4' });
      return [chicken({ availability: 'available' })];
    } });
    await expect(updateRetailerMapping(mapping.id, { role: 'alternative', packageBaseAmount: 500 })).rejects.toMatchObject({ status: 409 });
    expect(getRetailerMapping('demo-shop', 'chicken')).toMatchObject({ targetId: '2', role: 'preferred', confirmed: false });
  });

  it('reports stale availability without claiming a sparse refresh verified it', async () => {
    setup(); upsertRetailerProducts('demo-shop', [chicken({ availability: 'available' })], new Date('2026-01-01'));
    installGateway({ get: async () => [chicken()] });
    const result = await saveRetailerMapping(input);
    expect(result.availability).toMatchObject({ availability: 'available', refresh: 'no_statement', verified: false });
    expect(result.warnings).toContain('availability_unknown');
  });

  it('atomically replaces alternatives and preserves the old mapping on validation failure', async () => {
    setup(); upsertRetailerProducts('demo-shop', [chicken(), chicken({ id: 'other' })]);
    const { mapping } = await saveRetailerMapping({ ...input, role: 'alternative' });
    await expect(saveRetailerMapping({ ...input, retailerProductId: 'other', role: 'alternative', targetId: '2', replacesMappingId: mapping.id })).rejects.toMatchObject({ status: 409 });
    expect(getRetailerMapping('demo-shop', 'chicken')).not.toBeNull();
    await saveRetailerMapping({ ...input, retailerProductId: 'other', role: 'alternative', replacesMappingId: mapping.id });
    expect(getRetailerMapping('demo-shop', 'chicken')).toBeNull();
    expect(getRetailerMapping('demo-shop', 'other')?.role).toBe('alternative');
  });

  it('rejects reassignment from a stale dialog snapshot', async () => {
    setup(); upsertRetailerProducts('demo-shop', [chicken()]);
    upstream.products.push({ id: 2, name: 'Kipdij', qu_id_stock: 3 });
    await saveRetailerMapping(input);
    await expect(saveRetailerMapping({ ...input, targetId: '2', reassign: true, expectedTargetKey: 'grocy_product:3' })).rejects.toMatchObject({ status: 409 });
    expect(getRetailerMapping('demo-shop', 'chicken')?.targetId).toBe('1');
    expect((await saveRetailerMapping({ ...input, targetId: '2', reassign: true, expectedTargetKey: 'grocy_product:1' })).mapping.targetId).toBe('2');
  });

});

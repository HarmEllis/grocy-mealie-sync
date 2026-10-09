import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/db', async () => {
  const { createTestDb } = await import('@/test-utils/test-db');
  return { db: createTestDb() };
});
import { db } from '@/lib/db';
import { retailerMappings, retailerProducts, retailerSuggestions, shopCatalogSearches } from '@/lib/db/schema';
import { queueCatalogDiscovery, discoverCatalogProducts, listCatalogSearches, retryCatalogSearch } from '../catalog-discovery';
import { listSuggestions, rejectSuggestion, upsertRetailerMapping } from '../retailer-catalog';
import { emptyUnitContext } from '../units';
import type { ProjectionDemand } from '../projection';

const now = new Date('2026-10-07T12:00:00Z');
const context = () => {
  const ctx = emptyUnitContext();
  ctx.foodToGrocyProduct.set('tomatoes', 1);
  ctx.grocyProducts.set(1, { id: 1, name: 'Cherry tomaten', quIdStock: 1, quIdPurchase: 1, parentProductId: null, noOwnStock: false });
  return ctx;
};
const demand = (overrides: Partial<ProjectionDemand> = {}): ProjectionDemand => ({ revisionId: 'revision', mealieItemId: 'row', foodId: 'tomatoes', unitId: null, quantity: 1, subItems: null, label: 'Cherry tomaten', ...overrides });
const product = { id: '123', name: 'AH Cherry tomaten', packageAmount: 250, packageUnit: 'g', measure: 'unit' as const };

beforeEach(() => {
  for (const table of [shopCatalogSearches, retailerSuggestions, retailerMappings, retailerProducts]) db.delete(table).run();
});

describe('automatic retailer discovery for Mealie shopping demand', () => {
  it('finds a product and creates a proposal without confirming a mapping', async () => {
    expect(queueCatalogDiscovery('ah', [demand()], context(), now)).toBe(1);
    const search = vi.fn(async () => [product]);
    await discoverCatalogProducts('ah', search, now);
    expect(search).toHaveBeenCalledWith('Cherry tomaten');
    expect(listCatalogSearches('ah')[0]).toMatchObject({ status: 'complete', resultCount: 1 });
    expect(listSuggestions('ah')).toEqual([expect.objectContaining({ targetKind: 'grocy_product', targetId: '1', retailerProductId: '123' })]);
    expect(db.select().from(retailerMappings).all()).toEqual([]);
  });

  it('retains proposals and search results when a row is removed and re-added with a new ID', async () => {
    const search = vi.fn(async () => [product]);
    queueCatalogDiscovery('ah', [demand()], context(), now);
    await discoverCatalogProducts('ah', search, now);
    const proposalId = listSuggestions('ah')[0].id;
    queueCatalogDiscovery('ah', [], context(), now);
    expect(listCatalogSearches('ah')).toEqual([]);
    queueCatalogDiscovery('ah', [demand({ mealieItemId: 'new-row', revisionId: 'new-revision', quantity: 2 })], context(), now);
    await discoverCatalogProducts('ah', search, now);
    expect(search).toHaveBeenCalledTimes(1);
    expect(listSuggestions('ah')[0].id).toBe(proposalId);
    expect(listCatalogSearches('ah')[0].status).toBe('complete');
    rejectSuggestion(proposalId, now);
    retryCatalogSearch(listCatalogSearches('ah')[0].id);
    await discoverCatalogProducts('ah', search, new Date(Date.now() + 1000));
    expect(listSuggestions('ah')).toEqual([]);
  });

  it('does not search again for targets with preferred mappings, even pending amount confirmation', () => {
    upsertRetailerMapping({ providerId: 'ah', retailerProductId: '123', targetKind: 'grocy_product', targetId: '1', targetName: 'Cherry tomaten', role: 'preferred', baseUnitId: '1', baseUnitName: 'gram' });
    expect(queueCatalogDiscovery('ah', [demand()], context(), now)).toBe(0);
    expect(listCatalogSearches()).toEqual([]);
  });

  it('supports Mealie-only ingredients and independent providers', async () => {
    const d = demand({ foodId: 'basil', label: 'Basil' });
    queueCatalogDiscovery('ah', [d], context(), now);
    queueCatalogDiscovery('picnic', [d], context(), now);
    await discoverCatalogProducts('ah', async () => [{ ...product, name: 'Basil' }], now);
    expect(listSuggestions('ah')[0]).toMatchObject({ targetKind: 'mealie_food', targetId: 'basil' });
    expect(listCatalogSearches('picnic')[0].status).toBe('pending');
  });

  it('backs off failed searches without blocking another ingredient or exposing upstream secrets', async () => {
    queueCatalogDiscovery('ah', [demand(), demand({ foodId: 'basil', label: 'Basil' })], context(), now);
    const search = vi.fn(async (query: string) => {
      if (query === 'Cherry tomaten') throw new Error('secret token from upstream');
      return [];
    });
    await discoverCatalogProducts('ah', search, now);
    const failed = listCatalogSearches('ah').find(row => row.targetName === 'Cherry tomaten')!;
    expect(failed).toMatchObject({ status: 'error', attempts: 1 });
    expect(failed.lastError).not.toContain('secret');
    expect(listCatalogSearches('ah').find(row => row.targetName === 'Basil')?.status).toBe('complete');
    await discoverCatalogProducts('ah', search, new Date(now.getTime() + 1000));
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('limits each worker batch and ignores results for demand removed during the lookup', async () => {
    queueCatalogDiscovery('ah', Array.from({ length: 5 }, (_, i) => demand({ foodId: `food-${i}`, label: `Food ${i}` })), context(), now);
    const search = vi.fn(async () => []);
    await discoverCatalogProducts('ah', search, now);
    expect(search).toHaveBeenCalledTimes(3);
    await discoverCatalogProducts('ah', async () => { queueCatalogDiscovery('ah', [], context(), now); return [product]; }, now);
    expect(listSuggestions('ah')).toEqual([]);
  });
});

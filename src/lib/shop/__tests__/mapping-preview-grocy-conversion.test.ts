import { expect, it, vi } from 'vitest';
vi.mock('@/lib/db', async () => { const { createTestDb } = await import('@/test-utils/test-db'); return { db: createTestDb() }; });
vi.mock('../context', async () => {
  const { emptyUnitContext } = await import('../units');
  return { loadUnitContext: async () => {
    const ctx = emptyUnitContext();
    // Tomatenpuree: stocked in cans, 1 can = 70 g through the product's own Grocy conversion.
    ctx.grocyProducts.set(25, { id: 25, name: 'Tomatenpuree', quIdStock: 13, quIdPurchase: 13, parentProductId: null, noOwnStock: false });
    ctx.grocyUnitNames.set(13, 'blik');
    ctx.grocyUnitNames.set(15, 'gram');
    ctx.grocyConversions.push({ productId: 25, fromQuId: 13, toQuId: 15, factor: 70 });
    // Gebakken uitjes: stocked in pieces, no conversion to weight at all.
    ctx.grocyProducts.set(135, { id: 135, name: 'Gebakken uitjes', quIdStock: 2, quIdPurchase: 2, parentProductId: null, noOwnStock: false });
    ctx.grocyUnitNames.set(2, 'stuk');
    ctx.mealieUnits.set('g', { id: 'g', name: 'gram', abbreviation: 'g', standardUnit: 'g', standardQuantity: 1 });
    ctx.unitMappings.set('g', { grocyUnitId: 15, factor: 1 });
    return ctx;
  } };
});
import { mappingPreview } from '../mapping-preview';
import { upsertRetailerProducts } from '../retailer-catalog';

const preview = (retailerProductId: string, targetId: string) => mappingPreview({ providerId: 'demo', retailerProductId, targetKind: 'grocy_product', targetId });

it('derives a package amount through the product\'s own Grocy conversion when the stock unit is not a library unit', async () => {
  upsertRetailerProducts('demo', [{ id: 'puree', name: 'Tomatenpuree 200 g', measure: 'unit', packageAmount: 200, packageUnit: 'g' }]);
  const result = await preview('puree', '25');
  expect(result.baseUnitName).toBe('blik');
  expect(result.derivation?.amount).toBeCloseTo(200 / 70, 9);
  expect(result.derivation?.explanation).toBe('1 package = 200 gram = 2.857 blik (Grocy conversion)');
  expect(result.requiresConfirmation).toBe(true);
});

it('derives exactly one can for the 70 g package', async () => {
  upsertRetailerProducts('demo', [{ id: 'puree-70', name: 'Tomatenpuree 70 g', measure: 'unit', packageAmount: 70, packageUnit: 'g' }]);
  expect((await preview('puree-70', '25')).derivation?.amount).toBeCloseTo(1, 9);
});

it('never guesses when the product has no conversion between the package unit and its stock unit', async () => {
  upsertRetailerProducts('demo', [{ id: 'uitjes', name: 'Gebakken uitjes 150 g', measure: 'unit', packageAmount: 150, packageUnit: 'g' }]);
  expect((await preview('uitjes', '135')).derivation).toBeNull();
});

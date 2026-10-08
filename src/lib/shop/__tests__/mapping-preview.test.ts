import { expect, it, vi } from 'vitest';
vi.mock('@/lib/db', async () => { const { createTestDb } = await import('@/test-utils/test-db'); return { db: createTestDb() }; });
vi.mock('../context', async () => {
  const { emptyUnitContext } = await import('../units');
  return { loadUnitContext: async () => {
    const ctx = emptyUnitContext();
    ctx.grocyProducts.set(1, { id: 1, name: 'Chicken', quIdStock: 10, quIdPurchase: 10, parentProductId: null, noOwnStock: false });
    ctx.grocyUnitNames.set(10, 'gram');
    ctx.foodToGrocyProduct.set('chicken-food', 1);
    ctx.mealieFoodNames.set('chicken-food', 'Kipfilet');
    ctx.mealieUnits.set('kg', { id: 'kg', name: 'kilogram', abbreviation: 'kg', standardUnit: 'kg', standardQuantity: 1 });
    ctx.unitMappings.set('kg', { grocyUnitId: 10, factor: 1000 });
    return ctx;
  } };
});
import { mappingPreview } from '../mapping-preview';
import { upsertRetailerProducts } from '../retailer-catalog';
it('uses the existing unit mapping factor and derives package stock quantities without confirming', async () => {
  upsertRetailerProducts('demo', [{ id: 'chicken', name: 'Chicken 150g', measure: 'unit', packageAmount: 150, packageUnit: 'g' }]);
  const preview = await mappingPreview({ providerId: 'demo', retailerProductId: 'chicken', targetKind: 'grocy_product', targetId: '1' });
  expect(preview.derivation?.amount).toBe(150);
  expect(preview.linkedFoods).toEqual([{ id: 'chicken-food', name: 'Kipfilet' }]);
  expect(preview.conversions).toEqual([expect.objectContaining({ mealieUnitId: 'kg', ok: true, factor: 1000 })]);
  expect(preview.requiresConfirmation).toBe(true);
});

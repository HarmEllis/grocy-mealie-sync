import { beforeEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ potato: false }));
vi.mock('@/lib/db', async () => { const { createTestDb } = await import('@/test-utils/test-db'); return { db: createTestDb() }; });
vi.mock('@/lib/grocy/types', () => ({ getGrocyEntities: vi.fn(async (type: string) => type === 'products' ? [{ id: 1, name: 'Chicken breast', qu_id_stock: 10 }, { id: 2, name: 'Unlinked chicken', qu_id_stock: 10 }, ...(fixture.potato ? [{ id: 3, name: 'Potato', qu_id_stock: 10 }] : [])] : [{ id: 10, name: 'gram' }]) }));
vi.mock('@/lib/mealie', () => ({ RecipesFoodsService: { getAllApiFoodsGet: vi.fn(async () => ({ items: [{ id: 'f1', name: 'Kipfilet' }, { id: 'f2', name: 'Mealie chicken' }, ...(fixture.potato ? [{ id: 'f3', name: 'Aardappel' }] : [])] })) }, RecipesUnitsService: { getAllApiUnitsGet: vi.fn(async () => ({ items: [{ id: 'grams', name: 'gram' }] })) } }));
import { db } from '@/lib/db';
import { productMappings } from '@/lib/db/schema';
import { searchMappingTargets } from '../targets';
beforeEach(() => {
  fixture.potato = false;
  db.delete(productMappings).run();
  db.insert(productMappings).values({ id: 'mapping', createdAt: new Date(), updatedAt: new Date(), grocyProductId: 1, grocyProductName: 'Chicken breast', mealieFoodId: 'f1', mealieFoodName: 'Kipfilet' }).run();
});
it('ranks linked targets first and deduplicates their Mealie counterpart', async () => {
  const result = await searchMappingTargets('');
  expect(result.targets.map(target => target.source)).toEqual(['grocy_mealie', 'grocy', 'mealie']);
  expect(result.targets[0]).toMatchObject({ kind: 'grocy_product', id: '1', linkedFoods: [{ id: 'f1', name: 'Kipfilet' }] });
  expect(result.targets.some(target => target.kind === 'mealie_food' && target.id === 'f1')).toBe(false);
});
it('finds a linked Grocy target by its Mealie ingredient name', async () => {
  expect((await searchMappingTargets('Kipfilet')).targets[0]).toMatchObject({ id: '1', source: 'grocy_mealie' });
});

it('filters initial suggestions instead of inserting unrelated linked Mealie foods', async () => {
  fixture.potato = true;
  db.insert(productMappings).values({ id: 'potato', createdAt: new Date(), updatedAt: new Date(), grocyProductId: 3, grocyProductName: 'Potato', mealieFoodId: 'f3', mealieFoodName: 'Aardappel' }).run();
  const result = await searchMappingTargets('', 20, 'Unlinked chicken');
  expect(result.targets.some(target => target.kind === 'grocy_product' && target.id === '3')).toBe(false);
  expect(result.targets.some(target => target.id === '2')).toBe(true);
});

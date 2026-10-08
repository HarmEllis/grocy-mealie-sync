import { listOpenDemand } from './demand-observer';
import { loadUnitContext } from './context';
import { getRetailerProduct } from './retailer-catalog';
import { derivePackageBaseAmount, mealieQuantityToGrocyStock, type TargetKind } from './units';

/** Shared UI/MCP explanation of package amounts and existing unit conversion paths. */
export async function mappingPreview(input: { providerId: string; retailerProductId: string; targetKind: TargetKind; targetId: string; baseUnitId?: string | null }) {
  const ctx = await loadUnitContext();
  const product = getRetailerProduct(input.providerId, input.retailerProductId);
  const target = input.targetKind === 'grocy_product' ? ctx.grocyProducts.get(Number(input.targetId)) : null;
  const baseUnitId = target ? String(target.quIdStock ?? '') : input.baseUnitId ?? null;
  const baseUnitName = target ? ctx.grocyUnitNames.get(target.quIdStock!) ?? null : ctx.mealieUnits.get(baseUnitId ?? '')?.name ?? null;
  const derivation = product ? derivePackageBaseAmount({ measure: product.measure === 'weight' ? 'weight' : 'unit', packageAmount: product.packageAmount, packageUnit: product.packageUnit, baseUnitName: baseUnitName ?? (input.targetKind === 'mealie_food' && !baseUnitId ? 'piece' : null) }) : null;
  const linkedFoods = target ? [...ctx.foodToGrocyProduct].filter(([, id]) => id === target.id).map(([id]) => ({ id, name: ctx.mealieFoodNames.get(id) ?? id })) : [];
  const conversions = target ? [...ctx.mealieUnits.values()].map(unit => ({ mealieUnitId: unit.id, mealieUnitName: unit.name, ...mealieQuantityToGrocyStock(ctx, target.id, 1, unit.id) })) : [];
  const demandConversions = target ? listOpenDemand().filter(({ revision }) => revision.foodId && ctx.foodToGrocyProduct.get(revision.foodId) === target.id).map(({ demand, revision }) => ({ mealieItemId: demand.mealieItemId, mealieUnitId: revision.unitId, mealieUnitName: ctx.mealieUnits.get(revision.unitId ?? '')?.name ?? 'count', ...mealieQuantityToGrocyStock(ctx, target.id, revision.quantity ?? 1, revision.unitId) })) : [];
  return { demandConversions, baseUnitId, baseUnitName, derivation, linkedFoods, conversions, measure: product?.measure ?? 'unit', requiresConfirmation: true };
}

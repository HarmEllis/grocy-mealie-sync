import type {
  GrocyMinStockProductMapping,
  GrocyMinStockTabData,
  ProductMapping,
  ProductsTabData,
  UnitMapping,
  UnitsTabData,
  WizardData,
} from './types';

export type WizardTab = 'units' | 'products' | 'grocy-min-stock';

export function getDefaultWizardTab(data: WizardData): WizardTab {
  if (data.unmappedMealieUnits.length === 0 && data.unmappedMealieFoods.length > 0) {
    return 'products';
  }

  if (
    data.unmappedMealieUnits.length === 0 &&
    data.unmappedMealieFoods.length === 0 &&
    data.unmappedGrocyMinStockProducts.length > 0
  ) {
    return 'grocy-min-stock';
  }

  return 'units';
}

export function buildProductMaps(
  data: Pick<ProductsTabData, 'unmappedMealieFoods'>,
): Record<string, ProductMapping> {
  return Object.fromEntries(
    data.unmappedMealieFoods.map(food => [
      food.id,
      { mealieFoodId: food.id, grocyProductId: null, grocyUnitId: null },
    ]),
  );
}

export function buildUnitMaps(
  data: Pick<UnitsTabData, 'unmappedMealieUnits'>,
): Record<string, UnitMapping> {
  return Object.fromEntries(
    data.unmappedMealieUnits.map(unit => [
      unit.id,
      { mealieUnitId: unit.id, grocyUnitId: null },
    ]),
  );
}

export function buildGrocyMinStockProductMaps(
  data: Pick<GrocyMinStockTabData, 'unmappedGrocyMinStockProducts'>,
): Record<string, GrocyMinStockProductMapping> {
  return Object.fromEntries(
    data.unmappedGrocyMinStockProducts.map(product => [
      String(product.id),
      { grocyProductId: product.id, mealieFoodId: null, grocyUnitId: product.quIdPurchase || null },
    ]),
  );
}

export function mergeProductMaps(
  data: Pick<ProductsTabData, 'unmappedMealieFoods'>,
  previousMaps: Record<string, ProductMapping>,
): Record<string, ProductMapping> {
  return Object.fromEntries(
    data.unmappedMealieFoods.map(food => [
      food.id,
      previousMaps[food.id] ?? { mealieFoodId: food.id, grocyProductId: null, grocyUnitId: null },
    ]),
  );
}

export function mergeGrocyMinStockProductMaps(
  data: Pick<GrocyMinStockTabData, 'unmappedGrocyMinStockProducts'>,
  previousMaps: Record<string, GrocyMinStockProductMapping>,
): Record<string, GrocyMinStockProductMapping> {
  return Object.fromEntries(
    data.unmappedGrocyMinStockProducts.map(product => [
      String(product.id),
      previousMaps[String(product.id)] ?? {
        grocyProductId: product.id,
        mealieFoodId: null,
        grocyUnitId: product.quIdPurchase || null,
      },
    ]),
  );
}

export function mergeUnitMaps(
  data: Pick<UnitsTabData, 'unmappedMealieUnits'>,
  previousMaps: Record<string, UnitMapping>,
): Record<string, UnitMapping> {
  return Object.fromEntries(
    data.unmappedMealieUnits.map(unit => [
      unit.id,
      previousMaps[unit.id] ?? { mealieUnitId: unit.id, grocyUnitId: null },
    ]),
  );
}

export function mergeCheckedState(
  ids: Array<string | number>,
  previousChecked: Record<string, boolean>,
): Record<string, boolean> {
  const nextChecked: Record<string, boolean> = {};

  for (const id of ids) {
    const key = String(id);
    if (previousChecked[key]) {
      nextChecked[key] = true;
    }
  }

  return nextChecked;
}

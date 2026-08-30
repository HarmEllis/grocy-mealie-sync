import type {
  GrocyMinStockProductMapping,
  GrocyMinStockTabData,
  ProductMapping,
  ProductsTabData,
  SelectOption,
  UnitMapping,
  UnitMappingRef,
  UnitsTabData,
  WizardData,
} from './types';
import { sortByName } from './types';

export type WizardTab = 'units' | 'products' | 'grocy-min-stock' | 'mapped-products' | 'conflicts';

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

/**
 * The Grocy units a product's unit column may offer.
 *
 * A product mapping stores its unit as a `unitMappingId`, so a Grocy unit with
 * no mapping cannot be persisted at all: the sync routes look the mapping up by
 * `grocyUnitId` and store `null` when they find none. Offering the full unit
 * list therefore let a pick vanish without any error. Unmapped Grocy units are
 * handled in the Units tab instead, under the "Grocy only" filter.
 */
export function toMappedUnitOptions(unitMappings: UnitMappingRef[]): SelectOption[] {
  return sortByName(unitMappings.map(mapping => ({
    name: mapping.grocyUnitName,
    id: mapping.grocyUnitId,
  }))).map(unit => ({ value: unit.id, label: unit.name }));
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
  data: Pick<UnitsTabData, 'mealieUnits' | 'existingUnitMappings'>,
): Record<string, UnitMapping> {
  const existingMappingsByMealieUnitId = new Map(
    data.existingUnitMappings.map(mapping => [mapping.mealieUnitId, mapping.grocyUnitId]),
  );

  return Object.fromEntries(
    data.mealieUnits.map(unit => [
      unit.id,
      { mealieUnitId: unit.id, grocyUnitId: existingMappingsByMealieUnitId.get(unit.id) ?? null },
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
  data: Pick<UnitsTabData, 'mealieUnits' | 'existingUnitMappings'>,
  previousMaps: Record<string, UnitMapping>,
): Record<string, UnitMapping> {
  const existingMappingsByMealieUnitId = new Map(
    data.existingUnitMappings.map(mapping => [mapping.mealieUnitId, mapping.grocyUnitId]),
  );

  return Object.fromEntries(
    data.mealieUnits.map(unit => [
      unit.id,
      previousMaps[unit.id] ?? {
        mealieUnitId: unit.id,
        grocyUnitId: existingMappingsByMealieUnitId.get(unit.id) ?? null,
      },
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

export function getPendingUnitMappings(
  data: Pick<UnitsTabData, 'existingUnitMappings'>,
  unitMaps: Record<string, UnitMapping>,
): UnitMapping[] {
  const existingMappingsByMealieUnitId = new Map(
    data.existingUnitMappings.map(mapping => [mapping.mealieUnitId, mapping.grocyUnitId]),
  );

  return Object.values(unitMaps).filter(mapping => {
    if (mapping.grocyUnitId === null) {
      return false;
    }

    return existingMappingsByMealieUnitId.get(mapping.mealieUnitId) !== mapping.grocyUnitId;
  });
}

/**
 * Collect the target ids already claimed by a draft mapping, so a row can test
 * availability in O(1).
 *
 * Previously each row filtered the full option list with a nested
 * `Object.values(maps).some(...)`, i.e. one fresh array per option per row. At
 * ~5000 rows x ~5000 options that is ~25M allocations and ~1.25e11 comparisons
 * — the direct cause of the "Uncaught out of memory" in issue #46.
 */
export function buildTakenTargetIds<TDraft, TTarget extends string | number>(
  maps: Record<string, TDraft>,
  getTarget: (draft: TDraft) => TTarget | null | undefined,
): Set<TTarget> {
  const taken = new Set<TTarget>();

  for (const draft of Object.values(maps)) {
    const target = getTarget(draft);
    if (target !== null && target !== undefined) {
      taken.add(target);
    }
  }

  return taken;
}

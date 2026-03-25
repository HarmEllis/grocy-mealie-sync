import type { ProductMapping, UnitMapping, WizardData } from './types';

export type WizardTab = 'units' | 'products';

export function getDefaultWizardTab(data: WizardData): WizardTab {
  if (data.unmappedMealieUnits.length === 0 && data.unmappedMealieFoods.length > 0) {
    return 'products';
  }

  return 'units';
}

export function buildProductMaps(data: WizardData): Record<string, ProductMapping> {
  return Object.fromEntries(
    data.unmappedMealieFoods.map(food => [
      food.id,
      { mealieFoodId: food.id, grocyProductId: null, grocyUnitId: null },
    ]),
  );
}

export function buildUnitMaps(data: WizardData): Record<string, UnitMapping> {
  return Object.fromEntries(
    data.unmappedMealieUnits.map(unit => [
      unit.id,
      { mealieUnitId: unit.id, grocyUnitId: null },
    ]),
  );
}

export function mergeProductMaps(
  data: WizardData,
  previousMaps: Record<string, ProductMapping>,
): Record<string, ProductMapping> {
  return Object.fromEntries(
    data.unmappedMealieFoods.map(food => [
      food.id,
      previousMaps[food.id] ?? { mealieFoodId: food.id, grocyProductId: null, grocyUnitId: null },
    ]),
  );
}

export function mergeUnitMaps(
  data: WizardData,
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
  ids: string[],
  previousChecked: Record<string, boolean>,
): Record<string, boolean> {
  const nextChecked: Record<string, boolean> = {};

  for (const id of ids) {
    if (previousChecked[id]) {
      nextChecked[id] = true;
    }
  }

  return nextChecked;
}

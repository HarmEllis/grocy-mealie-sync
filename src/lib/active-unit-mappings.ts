interface UnitMappingLike {
  mealieUnitId: string;
  grocyUnitId: number;
}

interface MealieUnitLike {
  id?: string | null;
}

interface GrocyUnitLike {
  id?: number | string | null;
}

export function filterActiveUnitMappings<T extends UnitMappingLike>(
  mappings: T[],
  mealieUnits: MealieUnitLike[],
  grocyUnits: GrocyUnitLike[],
): T[] {
  const activeMealieUnitIds = new Set(
    mealieUnits
      .map(unit => unit.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );
  const activeGrocyUnitIds = new Set(
    grocyUnits
      .map(unit => Number(unit.id))
      .filter(id => Number.isFinite(id)),
  );

  return mappings.filter(mapping =>
    activeMealieUnitIds.has(mapping.mealieUnitId)
    && activeGrocyUnitIds.has(mapping.grocyUnitId),
  );
}

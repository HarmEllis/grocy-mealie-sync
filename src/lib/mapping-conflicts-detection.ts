export type MappingConflictType =
  | 'missing_mealie_food'
  | 'missing_grocy_product'
  | 'missing_mealie_unit'
  | 'missing_grocy_unit'
  | 'broken_product_unit_reference'
  | 'sync_reference_error';

export type MappingConflictKind = 'product' | 'unit';
export type MappingConflictSeverity = 'error' | 'warning';
export type MappingConflictSourceTab = 'products' | 'units';

export interface ProductMappingSnapshot {
  id: string;
  mealieFoodId: string;
  mealieFoodName: string;
  grocyProductId: number;
  grocyProductName: string;
  unitMappingId: string | null;
}

export interface UnitMappingSnapshot {
  id: string;
  mealieUnitId: string;
  mealieUnitName: string;
  grocyUnitId: number;
  grocyUnitName: string;
}

interface MealieEntitySnapshot {
  id: string;
  name: string;
}

interface GrocyEntitySnapshot {
  id: number;
  name: string;
}

export interface DetectedMappingConflict {
  key: string;
  type: MappingConflictType;
  mappingKind: MappingConflictKind;
  mappingId: string;
  sourceTab: MappingConflictSourceTab;
  severity: MappingConflictSeverity;
  mealieId: string | null;
  mealieName: string | null;
  grocyId: number | null;
  grocyName: string | null;
  summary: string;
}

interface DetectMappingConflictsInput {
  productMappings: ProductMappingSnapshot[];
  unitMappings: UnitMappingSnapshot[];
  mealieFoods: MealieEntitySnapshot[];
  mealieUnits: MealieEntitySnapshot[];
  grocyProducts: GrocyEntitySnapshot[];
  grocyUnits: GrocyEntitySnapshot[];
}

function buildConflictKey(type: MappingConflictType, mappingKind: MappingConflictKind, mappingId: string): string {
  return `${type}:${mappingKind}:${mappingId}`;
}

function createConflict(
  type: MappingConflictType,
  mappingKind: MappingConflictKind,
  mappingId: string,
  sourceTab: MappingConflictSourceTab,
  mealieId: string | null,
  mealieName: string | null,
  grocyId: number | null,
  grocyName: string | null,
  summary: string,
): DetectedMappingConflict {
  return {
    key: buildConflictKey(type, mappingKind, mappingId),
    type,
    mappingKind,
    mappingId,
    sourceTab,
    severity: 'error',
    mealieId,
    mealieName,
    grocyId,
    grocyName,
    summary,
  };
}

export function detectMappingConflicts(input: DetectMappingConflictsInput): DetectedMappingConflict[] {
  const mealieFoodIds = new Set(input.mealieFoods.map(food => food.id));
  const mealieUnitIds = new Set(input.mealieUnits.map(unit => unit.id));
  const grocyProductIds = new Set(input.grocyProducts.map(product => product.id));
  const grocyUnitIds = new Set(input.grocyUnits.map(unit => unit.id));
  const unitMappingsById = new Map(input.unitMappings.map(mapping => [mapping.id, mapping]));
  const invalidUnitMappingIds = new Set<string>();
  const conflicts: DetectedMappingConflict[] = [];

  for (const mapping of input.unitMappings) {
    if (!mealieUnitIds.has(mapping.mealieUnitId)) {
      invalidUnitMappingIds.add(mapping.id);
      conflicts.push(createConflict(
        'missing_mealie_unit',
        'unit',
        mapping.id,
        'units',
        mapping.mealieUnitId,
        mapping.mealieUnitName,
        mapping.grocyUnitId,
        mapping.grocyUnitName,
        `Mapped Mealie unit "${mapping.mealieUnitName}" no longer exists.`,
      ));
      continue;
    }

    if (!grocyUnitIds.has(mapping.grocyUnitId)) {
      invalidUnitMappingIds.add(mapping.id);
      conflicts.push(createConflict(
        'missing_grocy_unit',
        'unit',
        mapping.id,
        'units',
        mapping.mealieUnitId,
        mapping.mealieUnitName,
        mapping.grocyUnitId,
        mapping.grocyUnitName,
        `Mapped Grocy unit "${mapping.grocyUnitName}" no longer exists.`,
      ));
    }
  }

  for (const mapping of input.productMappings) {
    const mealieFoodMissing = !mealieFoodIds.has(mapping.mealieFoodId);
    const grocyProductMissing = !grocyProductIds.has(mapping.grocyProductId);

    if (mealieFoodMissing) {
      conflicts.push(createConflict(
        'missing_mealie_food',
        'product',
        mapping.id,
        'products',
        mapping.mealieFoodId,
        mapping.mealieFoodName,
        mapping.grocyProductId,
        mapping.grocyProductName,
        `Mapped Mealie product "${mapping.mealieFoodName}" no longer exists.`,
      ));
    }

    if (grocyProductMissing) {
      conflicts.push(createConflict(
        'missing_grocy_product',
        'product',
        mapping.id,
        'products',
        mapping.mealieFoodId,
        mapping.mealieFoodName,
        mapping.grocyProductId,
        mapping.grocyProductName,
        `Mapped Grocy product "${mapping.grocyProductName}" no longer exists.`,
      ));
    }

    if (!mealieFoodMissing && !grocyProductMissing && mapping.unitMappingId && (
      !unitMappingsById.has(mapping.unitMappingId) || invalidUnitMappingIds.has(mapping.unitMappingId)
    )) {
      conflicts.push(createConflict(
        'broken_product_unit_reference',
        'product',
        mapping.id,
        'units',
        mapping.mealieFoodId,
        mapping.mealieFoodName,
        mapping.grocyProductId,
        mapping.grocyProductName,
        `Mapped product "${mapping.mealieFoodName}" references an invalid unit mapping.`,
      ));
    }
  }

  return conflicts;
}

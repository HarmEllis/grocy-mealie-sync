export interface ProductMappingReference {
  mealieFoodId: string;
  mealieFoodName?: string;
  grocyProductId: number;
  grocyProductName?: string;
}

export interface UnitMappingReference {
  mealieUnitId: string;
  mealieUnitName?: string;
  grocyUnitId: number;
  grocyUnitName?: string;
}

export function findProductMappingConflict<T extends ProductMappingReference>(
  existingMappings: readonly T[],
  mealieFoodId: string,
  grocyProductId: number,
): T | null {
  return existingMappings.find(
    mapping => mapping.grocyProductId === grocyProductId && mapping.mealieFoodId !== mealieFoodId,
  ) ?? null;
}

export function findUnitMappingConflict<T extends UnitMappingReference>(
  existingMappings: readonly T[],
  mealieUnitId: string,
  grocyUnitId: number,
): T | null {
  return existingMappings.find(
    mapping => mapping.grocyUnitId === grocyUnitId && mapping.mealieUnitId !== mealieUnitId,
  ) ?? null;
}

export function findDuplicateGrocyProductAssignment(
  mappings: readonly Pick<ProductMappingReference, 'mealieFoodId' | 'grocyProductId'>[],
): { grocyProductId: number; mealieFoodIds: string[] } | null {
  const mealieFoodIdsByGrocyProductId = new Map<number, Set<string>>();

  for (const mapping of mappings) {
    const mealieFoodIds = mealieFoodIdsByGrocyProductId.get(mapping.grocyProductId) ?? new Set<string>();
    mealieFoodIds.add(mapping.mealieFoodId);
    mealieFoodIdsByGrocyProductId.set(mapping.grocyProductId, mealieFoodIds);

    if (mealieFoodIds.size > 1) {
      return {
        grocyProductId: mapping.grocyProductId,
        mealieFoodIds: Array.from(mealieFoodIds),
      };
    }
  }

  return null;
}

export function findDuplicateGrocyUnitAssignment(
  mappings: readonly Pick<UnitMappingReference, 'mealieUnitId' | 'grocyUnitId'>[],
): { grocyUnitId: number; mealieUnitIds: string[] } | null {
  const mealieUnitIdsByGrocyUnitId = new Map<number, Set<string>>();

  for (const mapping of mappings) {
    const mealieUnitIds = mealieUnitIdsByGrocyUnitId.get(mapping.grocyUnitId) ?? new Set<string>();
    mealieUnitIds.add(mapping.mealieUnitId);
    mealieUnitIdsByGrocyUnitId.set(mapping.grocyUnitId, mealieUnitIds);

    if (mealieUnitIds.size > 1) {
      return {
        grocyUnitId: mapping.grocyUnitId,
        mealieUnitIds: Array.from(mealieUnitIds),
      };
    }
  }

  return null;
}

export function formatProductMappingConflictMessage(
  conflict: ProductMappingReference,
  grocyProductId = conflict.grocyProductId,
): string {
  const grocyName = conflict.grocyProductName ? `"${conflict.grocyProductName}"` : `#${grocyProductId}`;
  const mealieName = conflict.mealieFoodName ? `"${conflict.mealieFoodName}"` : conflict.mealieFoodId;
  return `Grocy product ${grocyName} (#${grocyProductId}) is already mapped to Mealie food ${mealieName}.`;
}

export function formatUnitMappingConflictMessage(
  conflict: UnitMappingReference,
  grocyUnitId = conflict.grocyUnitId,
): string {
  const grocyName = conflict.grocyUnitName ? `"${conflict.grocyUnitName}"` : `#${grocyUnitId}`;
  const mealieName = conflict.mealieUnitName ? `"${conflict.mealieUnitName}"` : conflict.mealieUnitId;
  return `Grocy unit ${grocyName} (#${grocyUnitId}) is already mapped to Mealie unit ${mealieName}.`;
}

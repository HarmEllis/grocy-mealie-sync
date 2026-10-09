import { LIBRARY_UNITS, STANDARD_SCALES } from '../conversions/catalog';

/**
 * Pure unit helpers for shop projection and receipt reconciliation. Every
 * function returns `null` instead of guessing when a conversion is not known
 * exactly; callers send those cases to review.
 */

export type TargetKind = 'grocy_product' | 'mealie_food';

export interface GrocyProductInfo {
  id: number;
  name: string;
  quIdStock: number | null;
  quIdPurchase: number | null;
  parentProductId: number | null;
  noOwnStock: boolean;
}

export interface GrocyConversionInfo {
  fromQuId: number;
  toQuId: number;
  factor: number;
  productId: number | null;
}

export interface MealieUnitInfo {
  id: string;
  name: string;
  abbreviation: string | null;
  standardUnit: string | null;
  standardQuantity: number | null;
}

export interface UnitContext {
  grocyProducts: Map<number, GrocyProductInfo>;
  grocyUnitNames: Map<number, string>;
  grocyConversions: GrocyConversionInfo[];
  /** Mealie unit ID -> Grocy unit ID and factor (1 Mealie unit = factor Grocy units). */
  unitMappings: Map<string, { grocyUnitId: number; factor: number }>;
  mealieUnits: Map<string, MealieUnitInfo>;
  /** Mealie food ID -> mapped Grocy product ID. */
  foodToGrocyProduct: Map<string, number>;
  mealieFoodNames: Map<string, string>;
}

export function emptyUnitContext(): UnitContext {
  return {
    grocyProducts: new Map(),
    grocyUnitNames: new Map(),
    grocyConversions: [],
    unitMappings: new Map(),
    mealieUnits: new Map(),
    foodToGrocyProduct: new Map(),
    mealieFoodNames: new Map(),
  };
}

/** Factor to convert an amount in `fromQuId` into `toQuId` for a product, or null when unknown. */
export function grocyQuFactor(ctx: UnitContext, productId: number, fromQuId: number, toQuId: number): number | null {
  if (fromQuId === toQuId) return 1;
  const find = (scope: number | null) => {
    const direct = ctx.grocyConversions.find(c => c.productId === scope && c.fromQuId === fromQuId && c.toQuId === toQuId);
    if (direct && direct.factor > 0) return direct.factor;
    const inverse = ctx.grocyConversions.find(c => c.productId === scope && c.fromQuId === toQuId && c.toQuId === fromQuId);
    if (inverse && inverse.factor > 0) return 1 / inverse.factor;
    return null;
  };
  return find(productId) ?? find(null);
}

export type ConversionFailure =
  | 'unknown_product'
  | 'missing_unit'
  | 'purchase_unit_ambiguous'
  | 'no_conversion';

export type BaseAmountResult = { ok: true; amount: number; factor: number } | { ok: false; reason: ConversionFailure };

/**
 * Convert a Mealie row quantity into a Grocy product's stock unit.
 *
 * Rows labelled with a purchase unit that differs from the stock unit are
 * ambiguous: low-stock sync writes stock amounts with the purchase unit label,
 * while users write purchase amounts. Those rows go to review.
 */
export function mealieQuantityToGrocyStock(
  ctx: UnitContext,
  productId: number,
  quantity: number,
  mealieUnitId: string | null,
): BaseAmountResult {
  const product = ctx.grocyProducts.get(productId);
  if (!product || product.quIdStock === null) return { ok: false, reason: 'unknown_product' };
  const stockQu = product.quIdStock;
  if (!mealieUnitId) {
    if (product.quIdPurchase === null || product.quIdPurchase === stockQu) return { ok: true, amount: quantity, factor: 1 };
    return { ok: false, reason: 'missing_unit' };
  }
  const mapping = ctx.unitMappings.get(mealieUnitId);
  if (!mapping) return { ok: false, reason: 'no_conversion' };
  if (mapping.grocyUnitId === stockQu) return { ok: true, amount: quantity * mapping.factor, factor: mapping.factor };
  if (mapping.grocyUnitId === product.quIdPurchase) return { ok: false, reason: 'purchase_unit_ambiguous' };
  const factor = grocyQuFactor(ctx, productId, mapping.grocyUnitId, stockQu);
  if (factor === null) return { ok: false, reason: 'no_conversion' };
  return { ok: true, amount: quantity * mapping.factor * factor, factor: mapping.factor * factor };
}

function mealieStandardScale(unit: MealieUnitInfo | undefined): { dimension: string; scale: number } | null {
  if (!unit?.standardUnit) return null;
  const standard = STANDARD_SCALES[unit.standardUnit];
  if (!standard) return null;
  const quantity = unit.standardQuantity && unit.standardQuantity > 0 ? unit.standardQuantity : 1;
  return { dimension: standard.dimension, scale: standard.scale * quantity };
}

/** Convert a Mealie row quantity into the base unit of a Mealie-only target. `null` base unit means "count". */
export function mealieQuantityToMealieBase(
  ctx: UnitContext,
  quantity: number,
  rowUnitId: string | null,
  baseUnitId: string | null,
): BaseAmountResult {
  if ((rowUnitId ?? null) === (baseUnitId ?? null)) return { ok: true, amount: quantity, factor: 1 };
  if (!rowUnitId || !baseUnitId) return { ok: false, reason: 'missing_unit' };
  const from = mealieStandardScale(ctx.mealieUnits.get(rowUnitId));
  const to = mealieStandardScale(ctx.mealieUnits.get(baseUnitId));
  if (!from || !to || from.dimension !== to.dimension) return { ok: false, reason: 'no_conversion' };
  const factor = from.scale / to.scale;
  return { ok: true, amount: quantity * factor, factor };
}

/** Resolve a free-text unit ("g", "kilo", "liter") to the conversion library. */
export function resolveLibraryUnit(name: string | null | undefined) {
  if (!name) return null;
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  return LIBRARY_UNITS.find(unit => !unit.ambiguous && (unit.aliases.includes(needle) || unit.abbreviation.toLowerCase() === needle || unit.name.toLowerCase() === needle))
    ?? null;
}

const COUNT_UNIT_NAMES = new Set(['piece', 'pieces', 'pc', 'pcs', 'stuk', 'stuks', 'st', 'unit', 'units', 'each', 'ea', 'x']);

export function isCountUnitName(name: string | null | undefined): boolean {
  return Boolean(name && COUNT_UNIT_NAMES.has(name.trim().toLowerCase()));
}

/**
 * A confirmed package amount is only meaningful in the base unit it was
 * confirmed for. Grocy targets must still exist, keep own stock and use that
 * stock unit; Mealie-only targets with a unit need that unit to still exist.
 */
export function mappingBaseUnitValid(
  ctx: UnitContext,
  mapping: { targetKind: TargetKind; targetId: string; packageBaseUnitId: string | null },
): boolean {
  if (mapping.targetKind === 'grocy_product') {
    const product = ctx.grocyProducts.get(Number(mapping.targetId));
    return Boolean(product && !product.noOwnStock && product.quIdStock !== null && mapping.packageBaseUnitId === String(product.quIdStock));
  }
  return mapping.packageBaseUnitId === null || ctx.mealieUnits.has(mapping.packageBaseUnitId);
}

export interface PackageDerivation {
  amount: number;
  explanation: string;
}

/**
 * Derive how much of the target base unit one receipt quantity unit holds.
 * Returns null when no exact derivation exists; the user then enters it.
 */
export function derivePackageBaseAmount(input: {
  measure: 'unit' | 'weight';
  packageAmount?: number | null;
  packageUnit?: string | null;
  baseUnitName: string | null;
}): PackageDerivation | null {
  const base = resolveLibraryUnit(input.baseUnitName);
  if (input.measure === 'weight') {
    // Weight mappings use kilograms; receipt units are converted by the planner.
    const receiptUnit = resolveLibraryUnit('kg');
    if (!base || !receiptUnit || base.dimension !== receiptUnit.dimension) return null;
    const amount = receiptUnit.scale / base.scale;
    return { amount, explanation: `1 ${receiptUnit.abbreviation} = ${amount} ${base.abbreviation}` };
  }
  if (!input.packageAmount || input.packageAmount <= 0) {
    return isCountUnitName(input.baseUnitName) ? { amount: 1, explanation: '1 package = 1 piece' } : null;
  }
  const packageUnit = resolveLibraryUnit(input.packageUnit);
  if (packageUnit && base && packageUnit.dimension === base.dimension) {
    const amount = input.packageAmount * packageUnit.scale / base.scale;
    return { amount, explanation: `1 package = ${input.packageAmount} ${packageUnit.abbreviation} = ${amount} ${base.abbreviation}` };
  }
  if (isCountUnitName(input.packageUnit) && isCountUnitName(input.baseUnitName)) {
    return { amount: input.packageAmount, explanation: `1 package = ${input.packageAmount} pieces` };
  }
  return null;
}

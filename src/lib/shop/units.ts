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

type EdgeLookup = { kind: 'factor'; factor: number } | { kind: 'missing' } | { kind: 'conflict' };

const FACTOR_TOLERANCE = 1e-9;

function sameFactor(a: number, b: number): boolean {
  return Math.abs(a - b) <= FACTOR_TOLERANCE * Math.max(Math.abs(a), Math.abs(b));
}

function isValidFactor(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

interface ConversionIndex {
  size: number;
  /** "scope|from|to" -> every candidate factor, from direct and inverted records. */
  edges: Map<string, number[]>;
  /** Units that appear in a conversion per scope ("null" for global). */
  units: Map<string, Set<number>>;
}

const conversionIndexes = new WeakMap<GrocyConversionInfo[], ConversionIndex>();

/** Index the conversions once per list; rebuilt when records are added. */
function conversionIndex(ctx: UnitContext): ConversionIndex {
  const cached = conversionIndexes.get(ctx.grocyConversions);
  if (cached && cached.size === ctx.grocyConversions.length) return cached;
  const index: ConversionIndex = { size: ctx.grocyConversions.length, edges: new Map(), units: new Map() };
  const add = (key: string, factor: number) => {
    const list = index.edges.get(key);
    if (list) list.push(factor);
    else index.edges.set(key, [factor]);
  };
  for (const conversion of ctx.grocyConversions) {
    if (!isValidFactor(conversion.factor)) continue;
    const scope = String(conversion.productId);
    add(`${scope}|${conversion.fromQuId}|${conversion.toQuId}`, conversion.factor);
    add(`${scope}|${conversion.toQuId}|${conversion.fromQuId}`, 1 / conversion.factor);
    const units = index.units.get(scope) ?? new Set<number>();
    units.add(conversion.fromQuId);
    units.add(conversion.toQuId);
    index.units.set(scope, units);
  }
  conversionIndexes.set(ctx.grocyConversions, index);
  return index;
}

/** All candidate factors for one hop in one scope; direct and inverse records must agree. */
function lookupEdge(ctx: UnitContext, scope: number | null, fromQuId: number, toQuId: number): EdgeLookup {
  const candidates = conversionIndex(ctx).edges.get(`${String(scope)}|${fromQuId}|${toQuId}`) ?? [];
  if (candidates.length === 0) return { kind: 'missing' };
  return candidates.every(factor => sameFactor(factor, candidates[0])) ? { kind: 'factor', factor: candidates[0] } : { kind: 'conflict' };
}

/** One hop for a product: a product-specific record wins over a global one; conflicts never fall back. */
function lookupHop(ctx: UnitContext, productId: number, fromQuId: number, toQuId: number): EdgeLookup {
  const own = lookupEdge(ctx, productId, fromQuId, toQuId);
  return own.kind === 'missing' ? lookupEdge(ctx, null, fromQuId, toQuId) : own;
}

/**
 * Factor to convert an amount in `fromQuId` into `toQuId` for a product, or
 * null when unknown. A direct conversion wins; otherwise one intermediate unit
 * is allowed (kg -> g -> bag). Conflicting records or intermediate paths that
 * disagree return null instead of picking one.
 */
export function grocyQuFactor(ctx: UnitContext, productId: number, fromQuId: number, toQuId: number): number | null {
  if (fromQuId === toQuId) return 1;
  const direct = lookupHop(ctx, productId, fromQuId, toQuId);
  if (direct.kind === 'factor') return direct.factor;
  if (direct.kind === 'conflict') return null;

  const index = conversionIndex(ctx);
  const intermediates = new Set<number>([...(index.units.get(String(productId)) ?? []), ...(index.units.get('null') ?? [])]);
  intermediates.delete(fromQuId);
  intermediates.delete(toQuId);

  let found: number | null = null;
  for (const via of intermediates) {
    const first = lookupHop(ctx, productId, fromQuId, via);
    const second = lookupHop(ctx, productId, via, toQuId);
    if (first.kind === 'conflict' || second.kind === 'conflict') return null;
    if (first.kind !== 'factor' || second.kind !== 'factor') continue;
    const factor = first.factor * second.factor;
    if (!isValidFactor(factor)) return null;
    if (found !== null && !sameFactor(found, factor)) return null;
    found = found ?? factor;
  }
  return found;
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

/**
 * Whether a shopping row without a unit counts in the product's stock unit.
 * True when purchase and stock unit agree, or when the stock unit is itself a
 * count unit ("Stuk"): an empty Mealie unit means "pieces".
 */
export function emptyUnitMeansStock(ctx: UnitContext, productId: number): boolean {
  const product = ctx.grocyProducts.get(productId);
  if (!product || product.quIdStock === null) return false;
  if (product.quIdPurchase === null || product.quIdPurchase === product.quIdStock) return true;
  return isCountUnitName(ctx.grocyUnitNames.get(product.quIdStock));
}

export type CheckOffFailure = ConversionFailure | 'invalid_amount';

export type CheckOffAmountResult =
  | { ok: true; amount: number; factor: number }
  | { ok: false; reason: CheckOffFailure };

const CHECK_OFF_DECIMALS = 6;

/**
 * Convert a checked-off Mealie row into the amount to book in the product's
 * stock unit. Unlike `mealieQuantityToGrocyStock`, every case that cannot be
 * established exactly is refused, because a wrong booking pollutes stock:
 * rows labelled with a purchase unit that differs from the stock unit, empty
 * units that do not mean the stock unit, unknown conversions and amounts that
 * are not finite and positive.
 */
export function resolveCheckOffAmount(
  ctx: UnitContext,
  productId: number,
  quantity: number,
  mealieUnitId: string | null,
): CheckOffAmountResult {
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, reason: 'invalid_amount' };
  const product = ctx.grocyProducts.get(productId);
  if (!product || product.quIdStock === null) return { ok: false, reason: 'unknown_product' };
  let factor: number;
  if (!mealieUnitId) {
    if (!emptyUnitMeansStock(ctx, productId)) return { ok: false, reason: 'missing_unit' };
    factor = 1;
  } else {
    const mapping = ctx.unitMappings.get(mealieUnitId);
    if (!mapping || !isValidFactor(mapping.factor)) return { ok: false, reason: 'no_conversion' };
    if (mapping.grocyUnitId === product.quIdStock) {
      factor = mapping.factor;
    } else if (mapping.grocyUnitId === product.quIdPurchase) {
      return { ok: false, reason: 'purchase_unit_ambiguous' };
    } else {
      const unitFactor = grocyQuFactor(ctx, productId, mapping.grocyUnitId, product.quIdStock);
      if (unitFactor === null) return { ok: false, reason: 'no_conversion' };
      factor = mapping.factor * unitFactor;
    }
  }
  const amount = Number((quantity * factor).toFixed(CHECK_OFF_DECIMALS));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'invalid_amount' };
  return { ok: true, amount, factor };
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

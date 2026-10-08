import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { productMappings } from '../db/schema';
import { loadAllMealieUnits } from './product-inventory';
import { getGrocyEntities } from '../grocy/types';
import { ShopApiError } from './api-helpers';
import { refreshCatalogProducts } from './catalog-service';
import {
  availabilityNeedsRefresh,
  confirmRetailerMapping,
  deleteRetailerMapping,
  getRetailerMapping,
  getRetailerMappingById,
  getRetailerProduct,
  setRetailerMappingRole,
  upsertRetailerMapping,
  type MappingRole,
  type RetailerMappingRow,
} from './retailer-catalog';
import type { TargetKind } from './units';

/**
 * Validated mapping writes shared by the mapping, suggestion and MCP routes.
 *
 * - The base unit always comes from the source of truth: the Grocy stock unit
 *   of the target, or an existing Mealie unit (null = count). A client that
 *   sends a different unit cannot confirm an amount in it.
 * - Availability is refreshed with `catalog.get` when it is unknown or stale
 *   and a plugin is connected. Without a plugin the stored status is used and
 *   reported as-is, so known products can still be mapped offline.
 * - A product the retailer reports as discontinued cannot get a new mapping
 *   or become preferred. Existing mappings keep working with a warning.
 */

export type MappingWarning =
  | 'product_discontinued'
  | 'product_temporarily_unavailable'
  | 'availability_unknown'
  | 'base_unit_replaced';

export interface AvailabilityCheck {
  availability: 'available' | 'temporarily_unavailable' | 'discontinued' | 'unknown';
  availabilityCheckedAt: string | null;
  /** fresh: stored value was recent; refreshed: re-read now; not_returned: the plugin omitted it; offline: no check possible. */
  refresh: 'fresh' | 'refreshed' | 'not_returned' | 'no_statement' | 'offline' | 'not_stored';
  /** Whether a recent explicit availability statement exists. */
  verified: boolean;
}

export interface MappingSaveResult {
  mapping: RetailerMappingRow;
  availability: AvailabilityCheck;
  warnings: MappingWarning[];
}

interface BaseUnit {
  baseUnitId: string | null;
  baseUnitName: string | null;
  targetName: string | null;
}

/** Resolve the authoritative base unit of a target, or explain why it cannot be used. */
export async function resolveAuthoritativeBaseUnit(targetKind: TargetKind, targetId: string, requestedBaseUnitId: string | null): Promise<BaseUnit> {
  if (targetKind === 'grocy_product') {
    const [products, units] = await Promise.all([getGrocyEntities('products'), getGrocyEntities('quantity_units')]);
    const product = products.find(candidate => String(candidate.id) === targetId);
    const stockUnit = Number(product?.qu_id_stock);
    if (!product || !Number.isFinite(stockUnit) || stockUnit <= 0) {
      throw new ShopApiError(409, 'The Grocy product or its stock unit is no longer available.');
    }
    const unit = units.find(candidate => Number(candidate.id) === stockUnit);
    return { baseUnitId: String(stockUnit), baseUnitName: unit?.name ?? null, targetName: product.name ?? null };
  }
  if (!requestedBaseUnitId) return { baseUnitId: null, baseUnitName: null, targetName: null };
  const units = await loadAllMealieUnits();
  const unit = units.find(candidate => candidate.id === requestedBaseUnitId);
  if (!unit) throw new ShopApiError(409, 'The selected Mealie unit no longer exists. Choose the unit again.');
  return { baseUnitId: unit.id, baseUnitName: unit.name, targetName: null };
}

async function checkAvailability(providerId: string, retailerProductId: string, now: Date): Promise<AvailabilityCheck> {
  let row = getRetailerProduct(providerId, retailerProductId);
  let refresh: AvailabilityCheck['refresh'] = row ? 'fresh' : 'not_stored';
  if (availabilityNeedsRefresh(row, now)) {
    const previousCheck = row?.availabilityCheckedAt?.getTime();
    const result = await refreshCatalogProducts(providerId, [retailerProductId], { now });
    refresh = result.status === 'offline' ? 'offline' : result.missing.includes(retailerProductId) ? 'not_returned' : 'refreshed';
    row = getRetailerProduct(providerId, retailerProductId);
    if (refresh === 'refreshed' && row?.availabilityCheckedAt?.getTime() === previousCheck) refresh = 'no_statement';
  }
  const availability = (['available', 'temporarily_unavailable', 'discontinued'] as const).find(value => value === row?.availability) ?? 'unknown';
  return { availability, availabilityCheckedAt: row?.availabilityCheckedAt?.toISOString() ?? null, refresh, verified: !availabilityNeedsRefresh(row, now) };
}

function availabilityWarnings(check: AvailabilityCheck): MappingWarning[] {
  if (check.availability === 'discontinued') return ['product_discontinued'];
  if (check.availability === 'temporarily_unavailable') return ['product_temporarily_unavailable'];
  if (check.availability === 'unknown' || !check.verified) return ['availability_unknown'];
  return [];
}

function rejectDiscontinued(check: AvailabilityCheck, existing: RetailerMappingRow | null, role: MappingRole, target?: { kind: TargetKind; id: string }): void {
  if (check.availability !== 'discontinued') return;
  // Only the existing binding may be kept; pointing a discontinued product at another target is a new mapping.
  if (!existing || (target && (existing.targetKind !== target.kind || existing.targetId !== target.id))) {
    throw new ShopApiError(409, 'The retailer reports this product as no longer sold. Choose another product.');
  }
  if (role === 'preferred' && existing.role !== 'preferred') {
    throw new ShopApiError(409, 'The retailer reports this product as no longer sold, so it cannot become the preferred product.');
  }
}

export interface SaveMappingInput {
  providerId: string;
  retailerProductId: string;
  targetKind: TargetKind;
  targetId: string;
  targetName: string;
  role: MappingRole;
  baseUnitId: string | null;
  baseUnitName: string | null;
  packageBaseAmount?: number | null;
  confirm?: boolean;
  /** Explicitly authorize moving an existing retailer product to another target. */
  reassign?: boolean;
  /** Optional optimistic guard for a mapping shown by the caller. */
  expectedTargetKey?: string;
  /** Atomically replace an alternative belonging to this target. */
  replacesMappingId?: string;
}

/**
 * Create or replace a mapping after validating its unit and availability.
 * `beforeWrite` runs synchronously right before the write, after all awaits,
 * so callers can re-check state that may have changed meanwhile.
 */
export async function saveRetailerMapping(input: SaveMappingInput, options: { now?: Date; beforeWrite?: () => void } = {}): Promise<MappingSaveResult> {
  const now = options.now ?? new Date();
  const warnings: MappingWarning[] = [];
  const unit = await resolveAuthoritativeBaseUnit(input.targetKind, input.targetId, input.baseUnitId);
  const wantsConfirmation = Boolean(input.confirm || input.packageBaseAmount);
  if (input.confirm && input.packageBaseAmount == null) throw new ShopApiError(409, 'Echo an explicitly checked package amount before confirming; a derived amount is only a suggestion.');
  if (input.targetKind === 'grocy_product' && wantsConfirmation && input.baseUnitId === null) throw new ShopApiError(409, 'Provide the expected Grocy stock unit before confirming a package amount. Read the mapping preview first.');
  if (input.targetKind === 'grocy_product' && input.baseUnitId !== unit.baseUnitId) {
    if (wantsConfirmation) {
      throw new ShopApiError(409, `The Grocy stock unit is now ${unit.baseUnitName ?? `#${unit.baseUnitId}`}. Review the package amount in that unit before confirming.`);
    }
    if (input.baseUnitId !== null) warnings.push('base_unit_replaced');
  }
  const availability = await checkAvailability(input.providerId, input.retailerProductId, now);
  return db.transaction(() => {
    options.beforeWrite?.();
    const replacement = input.replacesMappingId ? getRetailerMappingById(input.replacesMappingId) : null;
    if (input.replacesMappingId && (!replacement || replacement.providerId !== input.providerId || replacement.role !== 'alternative' || replacement.targetKind !== input.targetKind || replacement.targetId !== input.targetId || input.role !== 'alternative')) throw new ShopApiError(409, 'The alternative being replaced changed. Reload the editor first.');
    const existing = getRetailerMapping(input.providerId, input.retailerProductId);
    if (input.expectedTargetKey && (!existing || `${existing.targetKind}:${existing.targetId}` !== input.expectedTargetKey)) throw new ShopApiError(409, 'The existing mapping changed. Reload it before moving this product.');
    const moving = existing && (existing.targetKind !== input.targetKind || existing.targetId !== input.targetId);
    const canonicalMove = moving && existing.targetKind === 'mealie_food' && input.targetKind === 'grocy_product'
      && db.select().from(productMappings).where(and(eq(productMappings.mealieFoodId, existing.targetId), eq(productMappings.grocyProductId, Number(input.targetId)))).get();
    if (moving && !canonicalMove && !input.reassign) throw new ShopApiError(409, `Already mapped to ${existing.targetName}. Remove that mapping first or explicitly authorize reassignment.`);
    rejectDiscontinued(availability, existing, input.role, { kind: input.targetKind, id: input.targetId });
    warnings.push(...availabilityWarnings(availability));

    // Re-saving a confirmed mapping without a new amount keeps its confirmation,
    // as long as target and unit are unchanged. Anything else needs a new confirmation.
    const keepConfirmed = existing?.confirmed && input.packageBaseAmount == null
      && existing.targetKind === input.targetKind && existing.targetId === input.targetId
      && existing.packageBaseUnitId === unit.baseUnitId && existing.packageBaseAmount;
    const mapping = upsertRetailerMapping({
      providerId: input.providerId,
      retailerProductId: input.retailerProductId,
      targetKind: input.targetKind,
      targetId: input.targetId,
      targetName: unit.targetName ?? input.targetName,
      role: input.role,
      baseUnitId: unit.baseUnitId,
      baseUnitName: unit.baseUnitName ?? (input.targetKind === 'mealie_food' ? null : input.baseUnitName),
      packageBaseAmount: keepConfirmed ? existing!.packageBaseAmount : input.packageBaseAmount,
      confirm: keepConfirmed ? true : input.confirm,
    }, now);
    if (replacement && replacement.id !== mapping.id) deleteRetailerMapping(replacement.id);
    return { mapping, availability, warnings };
  });
}

/** Change the role and/or confirm the package amount of an existing mapping. */
export async function updateRetailerMapping(id: string, body: { role?: MappingRole; packageBaseAmount?: number }, now = new Date()): Promise<MappingSaveResult> {
  const mapping = getRetailerMappingById(id);
  if (!mapping) throw new ShopApiError(404, 'Mapping not found');
  const warnings: MappingWarning[] = [];
  if (body.packageBaseAmount !== undefined) {
    // The amount is meaningful only in the unit the mapping stores; refuse it when that unit is outdated.
    const unit = await resolveAuthoritativeBaseUnit(mapping.targetKind as TargetKind, mapping.targetId, mapping.packageBaseUnitId);
    if (mapping.targetKind === 'grocy_product' && unit.baseUnitId !== mapping.packageBaseUnitId) {
      throw new ShopApiError(409, `The Grocy stock unit changed to ${unit.baseUnitName ?? `#${unit.baseUnitId}`}. Save the mapping again to confirm an amount in that unit.`);
    }
  }
  const availability = await checkAvailability(mapping.providerId, mapping.retailerProductId, now);
  return db.transaction(() => {
    const current = getRetailerMappingById(id);
    if (!current) throw new ShopApiError(404, 'Mapping not found');
    if (current.targetKind !== mapping.targetKind || current.targetId !== mapping.targetId || current.packageBaseUnitId !== mapping.packageBaseUnitId) throw new ShopApiError(409, 'The mapping target or unit changed while it was being checked. Reload it before confirming.');
    if (body.role) rejectDiscontinued(availability, current, body.role);
    warnings.push(...availabilityWarnings(availability));
    if (body.role && body.role !== current.role) setRetailerMappingRole(id, body.role, now);
    if (body.packageBaseAmount !== undefined) confirmRetailerMapping(id, body.packageBaseAmount, now);
    return { mapping: getRetailerMappingById(id)!, availability, warnings };
  });
}

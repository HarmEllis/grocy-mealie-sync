import { isCountUnitName, resolveLibraryUnit, type TargetKind } from './units';

/**
 * Pure receipt planning. Given a stored receipt, central mappings, the
 * exports that were active when it was bought, manual-check lifecycles and the
 * live open demand, decide per line:
 *
 * 1. credits: purchases already booked by a manual check (no second booking),
 * 2. allocations to exported demand that was still open at purchase time,
 * 3. allocations to other open demand for the same target,
 * 4. extras (still booked into Grocy for Grocy targets).
 *
 * Anything ambiguous goes to review instead of being guessed.
 */

export interface PlannerLine {
  id: string;
  lineNo: number;
  kind: string;
  retailerProductId: string | null;
  description: string;
  quantity: number;
  /** Receipt unit as reported by the retailer ("st", "kg", ...). */
  unit: string;
  amountCents: number | null;
}

export interface PlannerMapping {
  retailerProductId: string;
  targetKind: TargetKind;
  targetId: string;
  targetName: string;
  /**
   * `unit`: receipt quantities are packages and packageBaseAmount is per package.
   * `weight`: receipt quantities are weights and packageBaseAmount is per kilogram.
   */
  measure: 'unit' | 'weight';
  packageBaseAmount: number | null;
  confirmed: boolean;
  /** False when the target's base unit changed since the amount was confirmed. */
  baseUnitValid?: boolean;
}

export interface PlannerBooking {
  effectId: string;
  productId: number;
  amount: number;
  transactionId: string | null;
}

export interface PlannerLifecycle {
  id: string;
  mealieItemId: string;
  checkedObservedAt: Date;
  /** Applied Grocy bookings of this check (the actual child products). */
  bookings: PlannerBooking[];
  /** Amount per booking effect already credited by earlier receipts. */
  creditedByBooking?: Record<string, number>;
  /** @deprecated Kept for callers that only know per-product totals; ignored when per-booking data exists. */
  creditedByProduct?: Record<number, number>;
  /** Retailer products this row was exported as, with the export creation time. */
  exports: Array<{ retailerProductId: string; exportCreatedAt: Date }>;
}

export interface PlannerExportAllocation {
  exportId: string;
  retailerProductId: string;
  mealieItemId: string;
  revisionId: string;
  targetKind: TargetKind;
  targetId: string;
  baseAmount: number;
}

/** The demand revision that was current when the receipt was bought. */
export interface PurchaseRevision {
  revisionId: string;
  /** Fingerprint of food, unit and sub-products (not quantity). */
  identity: string;
  quantity: number;
  checked: boolean;
}

export interface PlannerDemand {
  mealieItemId: string;
  targetKind: TargetKind;
  targetId: string;
  /** Live row: quantity in the row's own unit, identity fingerprint, unchecked and still listed. */
  rowQuantity: number;
  rowIdentity: string;
  /** Base amount per row unit. */
  rowFactor: number;
  /** Revision active at purchase time, or null when the row did not exist yet. */
  purchaseRevision: PurchaseRevision | null;
  /** Row units already removed by our own applied receipt reductions after the purchase. */
  ownReductionsSincePurchase: number;
  firstSeenAt: Date;
}

export interface PlannerInput {
  receipt: { id: string; purchasedAt: Date; fetchedAt: Date };
  lines: PlannerLine[];
  mappings: Map<string, PlannerMapping>;
  /** Allocations of the export versions active at purchase time, for this installation. */
  exportAllocations: PlannerExportAllocation[];
  lifecycles: PlannerLifecycle[];
  /** Live Mealie rows with a resolved target (open or checked). */
  demand: PlannerDemand[];
}

export interface PlannedCredit {
  lifecycleId: string;
  mealieItemId: string;
  productId: number;
  amount: number;
  bookingEffectId: string;
}

export interface PlannedAllocation {
  mealieItemId: string;
  revisionId: string | null;
  exportId: string | null;
  baseAmount: number;
  rowFactor: number;
  rowQuantityBefore: number;
}

export interface PlannedDiscrepancy {
  kind: 'over_booked_manual_check';
  lifecycleId: string;
  productId: number;
  bookedAmount: number;
  receiptAmount: number;
  bookings: PlannerBooking[];
}

export type LineReviewReason =
  | 'unknown_product'
  | 'mapping_missing'
  | 'mapping_unconfirmed'
  | 'invalid_quantity'
  | 'unit_mismatch'
  | 'mapping_unit_changed'
  | 'ambiguous_credit';

export interface LinePlan {
  lineId: string;
  status: 'planned' | 'review' | 'ignored';
  reviewReason?: LineReviewReason;
  target?: { kind: TargetKind; id: string; name: string };
  baseAmount: number;
  credits: PlannedCredit[];
  allocations: PlannedAllocation[];
  extraAmount: number;
  /** Amount to book into Grocy (Grocy targets only): purchase minus credits. */
  bookAmount: number;
  /** Price per base unit, when the line carries an amount. */
  unitPrice: number | null;
  discrepancies: PlannedDiscrepancy[];
}

export interface RowReduction {
  mealieItemId: string;
  rowQuantityBefore: number;
  rowQuantityAfter: number;
  /** Row identity the reduction was planned against; the write is refused if it changed. */
  rowIdentity: string;
  lineIds: string[];
}

export interface ReceiptPlan {
  lines: LinePlan[];
  reductions: RowReduction[];
}

const EPSILON = 1e-9;

function round(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

/**
 * Convert a receipt quantity into "mapping units": packages for unit
 * products, kilograms for weighed products. Null when the receipt unit does
 * not fit the mapping's measure.
 */
export function receiptQuantityInMappingUnits(quantity: number, unit: string, measure: 'unit' | 'weight'): number | null {
  const trimmed = unit.trim();
  const library = resolveLibraryUnit(trimmed);
  if (measure === 'unit') {
    if (!trimmed || isCountUnitName(trimmed)) return quantity;
    return null;
  }
  if (!library || library.dimension !== 'mass') return null;
  return quantity * library.scale / 1000;
}

/**
 * Open amount (row units) a receipt may still fulfil on this row. The row must
 * have existed at purchase time with the same food, unit and sub-products, and
 * only what was open then (minus our own later reductions) can be fulfilled.
 */
export function openRowQuantityForPurchase(row: PlannerDemand): number {
  const atPurchase = row.purchaseRevision;
  if (!atPurchase || atPurchase.checked || atPurchase.identity !== row.rowIdentity) return 0;
  return Math.max(0, Math.min(row.rowQuantity, atPurchase.quantity - row.ownReductionsSincePurchase));
}

export function planReceipt(input: PlannerInput): ReceiptPlan {
  const plans: LinePlan[] = [];
  const remainingCredit = new Map<string, number>();
  const rowAllocated = new Map<string, number>();
  const demandByItem = new Map(input.demand.map(row => [row.mealieItemId, row]));

  // Credits are tracked per actual booking: one check can book the same child product twice.
  const creditedBefore = (lifecycle: PlannerLifecycle, booking: PlannerBooking) =>
    lifecycle.creditedByBooking?.[booking.effectId] ?? 0;
  const remainingFor = (lifecycle: PlannerLifecycle, booking: PlannerBooking) => {
    if (!remainingCredit.has(booking.effectId)) {
      remainingCredit.set(booking.effectId, Math.max(0, booking.amount - creditedBefore(lifecycle, booking)));
    }
    return remainingCredit.get(booking.effectId)!;
  };

  const rowOpenBase = (row: PlannerDemand) =>
    openRowQuantityForPurchase(row) * row.rowFactor - (rowAllocated.get(row.mealieItemId) ?? 0);

  for (const line of [...input.lines].sort((a, b) => a.lineNo - b.lineNo)) {
    const plan: LinePlan = {
      lineId: line.id,
      status: 'planned',
      baseAmount: 0,
      credits: [],
      allocations: [],
      extraAmount: 0,
      bookAmount: 0,
      unitPrice: null,
      discrepancies: [],
    };
    plans.push(plan);

    if (line.kind !== 'product') {
      plan.status = 'ignored';
      continue;
    }
    if (!line.retailerProductId) {
      plan.status = 'review';
      plan.reviewReason = 'unknown_product';
      continue;
    }
    const mapping = input.mappings.get(line.retailerProductId);
    if (!mapping) {
      plan.status = 'review';
      plan.reviewReason = 'mapping_missing';
      continue;
    }
    if (!mapping.confirmed || !mapping.packageBaseAmount || mapping.packageBaseAmount <= 0) {
      plan.status = 'review';
      plan.reviewReason = 'mapping_unconfirmed';
      continue;
    }
    if (mapping.baseUnitValid === false) {
      plan.status = 'review';
      plan.reviewReason = 'mapping_unit_changed';
      continue;
    }
    if (!(line.quantity > 0)) {
      // Returns and corrections are never booked automatically.
      plan.status = 'review';
      plan.reviewReason = 'invalid_quantity';
      continue;
    }

    const mappingUnits = receiptQuantityInMappingUnits(line.quantity, line.unit, mapping.measure);
    if (mappingUnits === null) {
      plan.status = 'review';
      plan.reviewReason = 'unit_mismatch';
      continue;
    }
    const total = round(mappingUnits * mapping.packageBaseAmount);
    plan.baseAmount = total;
    plan.target = { kind: mapping.targetKind, id: mapping.targetId, name: mapping.targetName };
    plan.unitPrice = line.amountCents !== null && total > 0 ? round(line.amountCents / 100 / total) : null;
    let remaining = total;

    // 1. Credits for manual checks of exported rows of this retailer product.
    if (mapping.targetKind === 'grocy_product') {
      const productId = Number(mapping.targetId);
      const candidates = input.lifecycles.flatMap((lifecycle) => {
        // The row must have been exported for this product before both the check and the purchase.
        const exported = lifecycle.exports.some(entry =>
          entry.retailerProductId === line.retailerProductId
          && entry.exportCreatedAt.getTime() <= lifecycle.checkedObservedAt.getTime()
          && entry.exportCreatedAt.getTime() <= input.receipt.purchasedAt.getTime());
        if (!exported || lifecycle.checkedObservedAt.getTime() > input.receipt.fetchedAt.getTime()) return [];
        return lifecycle.bookings
          .filter(booking => booking.productId === productId && remainingFor(lifecycle, booking) > EPSILON)
          .map(booking => ({ lifecycle, booking, remaining: remainingFor(lifecycle, booking) }));
      });
      const candidateTotal = candidates.reduce((sum, candidate) => sum + candidate.remaining, 0);
      if (candidates.length > 0 && candidateTotal <= remaining + EPSILON) {
        for (const candidate of candidates) {
          plan.credits.push({
            lifecycleId: candidate.lifecycle.id,
            mealieItemId: candidate.lifecycle.mealieItemId,
            productId,
            amount: candidate.remaining,
            bookingEffectId: candidate.booking.effectId,
          });
          remainingCredit.set(candidate.booking.effectId, 0);
          remaining = round(remaining - candidate.remaining);
        }
      } else if (candidates.length === 1) {
        // The check booked more than this line bought: credit what was bought and flag the rest.
        const [candidate] = candidates;
        plan.credits.push({
          lifecycleId: candidate.lifecycle.id,
          mealieItemId: candidate.lifecycle.mealieItemId,
          productId,
          amount: remaining,
          bookingEffectId: candidate.booking.effectId,
        });
        remainingCredit.set(candidate.booking.effectId, round(candidate.remaining - remaining));
        plan.discrepancies.push({
          kind: 'over_booked_manual_check',
          lifecycleId: candidate.lifecycle.id,
          productId,
          bookedAmount: candidate.booking.amount,
          receiptAmount: round(remaining + creditedBefore(candidate.lifecycle, candidate.booking)),
          bookings: candidate.lifecycle.bookings,
        });
        remaining = 0;
      } else if (candidates.length > 1) {
        plan.status = 'review';
        plan.reviewReason = 'ambiguous_credit';
        plan.target = undefined;
        plan.baseAmount = 0;
        continue;
      }
    }

    // 2. Exported demand that was open at purchase time, oldest first.
    const exported = input.exportAllocations
      .filter(allocation => allocation.retailerProductId === line.retailerProductId
        && allocation.targetKind === mapping.targetKind && allocation.targetId === mapping.targetId)
      .map(allocation => ({ allocation, row: demandByItem.get(allocation.mealieItemId) }))
      .filter((entry): entry is { allocation: PlannerExportAllocation; row: PlannerDemand } => Boolean(
        entry.row
        && entry.row.targetKind === mapping.targetKind
        && entry.row.targetId === mapping.targetId
        && rowOpenBase(entry.row) > EPSILON,
      ))
      .sort((a, b) => a.row.firstSeenAt.getTime() - b.row.firstSeenAt.getTime());
    for (const { allocation, row } of exported) {
      if (remaining <= EPSILON) break;
      const rowOpen = rowOpenBase(row);
      const amount = round(Math.min(remaining, allocation.baseAmount, rowOpen));
      if (amount <= EPSILON) continue;
      plan.allocations.push({
        mealieItemId: row.mealieItemId,
        revisionId: row.purchaseRevision?.revisionId ?? allocation.revisionId,
        exportId: allocation.exportId,
        baseAmount: amount,
        rowFactor: row.rowFactor,
        rowQuantityBefore: row.rowQuantity,
      });
      rowAllocated.set(row.mealieItemId, (rowAllocated.get(row.mealieItemId) ?? 0) + amount);
      remaining = round(remaining - amount);
    }

    // 3. Other open demand for the same target.
    const others = input.demand
      .filter(row => row.targetKind === mapping.targetKind && row.targetId === mapping.targetId && rowOpenBase(row) > EPSILON)
      .sort((a, b) => a.firstSeenAt.getTime() - b.firstSeenAt.getTime());
    for (const row of others) {
      if (remaining <= EPSILON) break;
      const rowOpen = rowOpenBase(row);
      const amount = round(Math.min(remaining, rowOpen));
      if (amount <= EPSILON) continue;
      plan.allocations.push({
        mealieItemId: row.mealieItemId,
        revisionId: row.purchaseRevision?.revisionId ?? null,
        exportId: null,
        baseAmount: amount,
        rowFactor: row.rowFactor,
        rowQuantityBefore: row.rowQuantity,
      });
      rowAllocated.set(row.mealieItemId, (rowAllocated.get(row.mealieItemId) ?? 0) + amount);
      remaining = round(remaining - amount);
    }

    // 4. Extras.
    plan.extraAmount = Math.max(0, remaining);
    const credited = plan.credits.reduce((sum, credit) => sum + credit.amount, 0);
    plan.bookAmount = mapping.targetKind === 'grocy_product' ? round(Math.max(0, total - credited)) : 0;
  }

  // One compare-and-set reduction per Mealie row, combining all lines of this receipt.
  const reductions = new Map<string, RowReduction>();
  for (const plan of plans) {
    for (const allocation of plan.allocations) {
      const existing = reductions.get(allocation.mealieItemId) ?? {
        mealieItemId: allocation.mealieItemId,
        rowQuantityBefore: allocation.rowQuantityBefore,
        rowQuantityAfter: allocation.rowQuantityBefore,
        rowIdentity: demandByItem.get(allocation.mealieItemId)?.rowIdentity ?? '',
        lineIds: [],
      };
      existing.rowQuantityAfter = round(existing.rowQuantityAfter - allocation.baseAmount / allocation.rowFactor);
      if (!existing.lineIds.includes(plan.lineId)) existing.lineIds.push(plan.lineId);
      reductions.set(allocation.mealieItemId, existing);
    }
  }
  for (const reduction of reductions.values()) {
    if (reduction.rowQuantityAfter < EPSILON) reduction.rowQuantityAfter = 0;
  }
  return { lines: plans, reductions: [...reductions.values()] };
}

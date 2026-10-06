import { randomUUID } from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  checkLifecycles,
  demandRevisions,
  demands,
  discrepancies,
  receiptLines,
  receipts,
  reconciliationLinks,
} from '../db/schema';
import type { HistoryEventInput } from '../history-store';
import type { MealieShoppingItem } from '../mealie/types';
import { getInstallation, type PluginInstallation } from '../plugins/installations';
import { activityEvent } from '../sync/activity';
import { getLifecycleBookings } from './check-lifecycles';
import { identityOf, parseSubItems, rowIdentityOf } from './demand-observer';
import {
  defaultEffectRunnerDeps,
  runGrocyAddEffect,
  runMealieReduceEffect,
  verifyGrocyAddEffect,
  type EffectRunnerDeps,
  type GrocyAddPayload,
  type MealieReducePayload,
} from './effect-runners';
import { ensureEffect, listEffects, recoverInterruptedEffects, type EffectStatus, type LedgerTx, type ShopEffect } from './ledger';
import { exportsActiveAt, listAllocations, listExportsForProduct } from './projection';
import {
  planReceipt,
  type PlannerDemand,
  type PlannerExportAllocation,
  type PlannerLifecycle,
  type PlannerMapping,
  type ReceiptPlan,
} from './reconcile-planner';
import { getReceiptLines, listReceipts, setReceiptStatus, type ReceiptRow } from './receipts';
import { getRetailerProduct, listRetailerMappings } from './retailer-catalog';
import { mappingBaseUnitValid, mealieQuantityToGrocyStock, mealieQuantityToMealieBase, type TargetKind, type UnitContext } from './units';

export const TERMINAL_STATUSES: EffectStatus[] = ['applied', 'superseded', 'cancelled'];
const MAX_EFFECTS_PER_RUN = 50;
const MAX_DEFINITE_FAILURE_ATTEMPTS = 5;

export interface ReconcileDeps {
  runner: EffectRunnerDeps;
  shoppingListId: string | null;
  loadMealieItems: (shoppingListId: string) => Promise<MealieShoppingItem[]>;
  loadUnitContext: () => Promise<UnitContext>;
  /** Tolerance for rows first observed slightly after a purchase (one poll interval). */
  observationGraceMs: number;
  now: () => Date;
}

export interface ReconcileSummary {
  verified: number;
  planned: number;
  applied: number;
  unknown: number;
  failed: number;
  processedReceipts: number;
  reviewReceipts: number;
}

export interface ReconcileResult {
  status: 'ok' | 'partial' | 'skipped' | 'error';
  summary: ReconcileSummary;
  events: HistoryEventInput[];
  message?: string;
}

function emptySummary(): ReconcileSummary {
  return { verified: 0, planned: 0, applied: 0, unknown: 0, failed: 0, processedReceipts: 0, reviewReceipts: 0 };
}

/** Effects belonging to a receipt: its own bookings and reductions plus confirmed substitutions. */
export function receiptEffects(receiptId: string): ShopEffect[] {
  return listEffects({ sourceRefs: [receiptId] }).filter(effect => effect.sourceKind === 'receipt' || effect.sourceKind === 'substitution');
}

function hasOpenEffects(receiptId: string): boolean {
  return receiptEffects(receiptId).some(effect => !TERMINAL_STATUSES.includes(effect.status));
}

/** Persisted receipt work must keep running even after the last plugin is revoked. */
export function hasPendingReceiptEffects(): boolean {
  return listEffects({ statuses: ['planned', 'in_flight', 'not_applied', 'unknown'] })
    .some(effect => effect.sourceKind === 'receipt' || effect.sourceKind === 'substitution');
}

// ---------------------------------------------------------------------------
// Planner input
// ---------------------------------------------------------------------------

function demandTargetFor(
  item: MealieShoppingItem,
  ctx: UnitContext,
  mealieBaseUnits: Map<string, string | null>,
): { targetKind: TargetKind; targetId: string; rowFactor: number } | null {
  const subItems = parseSubItems(item);
  if (subItems) {
    // Sub-product rows carry stock amounts; a single child is its own target.
    const target = subItems.length === 1 ? subItems[0].grocyProductId : (item.foodId ? ctx.foodToGrocyProduct.get(item.foodId) : undefined);
    return target === undefined ? null : { targetKind: 'grocy_product', targetId: String(target), rowFactor: 1 };
  }
  if (!item.foodId) return null;
  const productId = ctx.foodToGrocyProduct.get(item.foodId);
  if (productId !== undefined) {
    const converted = mealieQuantityToGrocyStock(ctx, productId, 1, item.unitId ?? null);
    return converted.ok ? { targetKind: 'grocy_product', targetId: String(productId), rowFactor: converted.factor } : null;
  }
  if (!mealieBaseUnits.has(item.foodId)) return null;
  const converted = mealieQuantityToMealieBase(ctx, 1, item.unitId ?? null, mealieBaseUnits.get(item.foodId) ?? null);
  return converted.ok ? { targetKind: 'mealie_food', targetId: item.foodId, rowFactor: converted.factor } : null;
}

function purchaseRevisionFor(mealieItemId: string, purchasedAt: Date, graceMs: number) {
  const revisions = db.select().from(demandRevisions).where(eq(demandRevisions.mealieItemId, mealieItemId)).all()
    .sort((a, b) => a.revision - b.revision);
  if (revisions.length === 0) return null;
  const at = purchasedAt.getTime();
  const before = revisions.filter(revision => revision.observedAt.getTime() <= at);
  const chosen = before.length > 0
    ? before[before.length - 1]
    // Rows are observed once per poll; accept a first observation within one interval of the purchase.
    : revisions[0].revision === 1 && revisions[0].observedAt.getTime() <= at + graceMs ? revisions[0] : null;
  if (!chosen) return null;
  let subItems = null;
  try {
    subItems = chosen.subItemsJson ? JSON.parse(chosen.subItemsJson) : null;
  } catch {
    subItems = null;
  }
  return {
    revisionId: chosen.id,
    identity: identityOf({ foodId: chosen.foodId, unitId: chosen.unitId, subItems }),
    quantity: chosen.quantity,
    checked: chosen.checked,
  };
}

/** Row units removed by our own applied reductions after `since`. */
function ownReductionsSince(mealieItemId: string, since: Date): number {
  let total = 0;
  for (const effect of listEffects<MealieReducePayload>({ kinds: ['mealie_reduce'], statuses: ['applied'] })) {
    if (effect.payload.itemId !== mealieItemId) continue;
    const appliedAt = typeof effect.evidence?.appliedAt === 'string' ? new Date(effect.evidence.appliedAt) : effect.updatedAt;
    if (appliedAt.getTime() <= since.getTime()) continue;
    total += Math.max(0, effect.payload.expectedBefore - Math.max(0, effect.payload.expectedAfter));
  }
  return total;
}

function lifecyclesForProducts(installationId: string, retailerProductIds: string[]): PlannerLifecycle[] {
  const exportsByItem = new Map<string, Array<{ retailerProductId: string; exportCreatedAt: Date }>>();
  for (const retailerProductId of retailerProductIds) {
    const exports = listExportsForProduct(installationId, retailerProductId);
    const createdById = new Map(exports.map(row => [row.id, row.createdAt]));
    for (const allocation of listAllocations(exports.map(row => row.id))) {
      const entries = exportsByItem.get(allocation.mealieItemId) ?? [];
      entries.push({ retailerProductId, exportCreatedAt: createdById.get(allocation.exportId)! });
      exportsByItem.set(allocation.mealieItemId, entries);
    }
  }
  const itemIds = [...exportsByItem.keys()];
  if (itemIds.length === 0) return [];
  const rows = db.select().from(checkLifecycles)
    .where(and(inArray(checkLifecycles.mealieItemId, itemIds), eq(checkLifecycles.status, 'completed')))
    .all();
  return rows.flatMap((lifecycle) => {
    const bookings = getLifecycleBookings(lifecycle.id)
      .filter(booking => booking.status === 'applied')
      .map(booking => ({ effectId: booking.effectId, productId: booking.productId, amount: booking.amount, transactionId: booking.transactionId }));
    if (bookings.length === 0) return [];
    const creditedByBooking: Record<string, number> = {};
    const links = db.select().from(reconciliationLinks)
      .where(and(eq(reconciliationLinks.lifecycleId, lifecycle.id), eq(reconciliationLinks.kind, 'credit')))
      .all();
    for (const link of links) {
      if (link.effectId) creditedByBooking[link.effectId] = (creditedByBooking[link.effectId] ?? 0) + link.baseAmount;
    }
    return [{
      id: lifecycle.id,
      mealieItemId: lifecycle.mealieItemId,
      checkedObservedAt: lifecycle.checkedObservedAt,
      bookings,
      creditedByBooking,
      exports: exportsByItem.get(lifecycle.mealieItemId) ?? [],
    }];
  });
}

export async function buildPlannerInput(
  receipt: ReceiptRow,
  installation: PluginInstallation,
  items: MealieShoppingItem[],
  ctx: UnitContext,
  graceMs: number,
) {
  const providerId = installation.providerId ?? receipt.providerId;
  const lines = getReceiptLines(receipt.id).filter(line => line.status === 'pending');
  const mappings = new Map<string, PlannerMapping>();
  const mealieBaseUnits = new Map<string, string | null>();
  for (const mapping of listRetailerMappings(providerId)) {
    const product = getRetailerProduct(providerId, mapping.retailerProductId);
    mappings.set(mapping.retailerProductId, {
      retailerProductId: mapping.retailerProductId,
      targetKind: mapping.targetKind as TargetKind,
      targetId: mapping.targetId,
      targetName: mapping.targetName,
      measure: product?.measure === 'weight' ? 'weight' : 'unit',
      packageBaseAmount: mapping.packageBaseAmount,
      confirmed: mapping.confirmed,
      baseUnitValid: mappingBaseUnitValid(ctx, {
        targetKind: mapping.targetKind as TargetKind,
        targetId: mapping.targetId,
        packageBaseUnitId: mapping.packageBaseUnitId,
      }),
    });
    if (mapping.targetKind === 'mealie_food' && !mealieBaseUnits.has(mapping.targetId)) {
      mealieBaseUnits.set(mapping.targetId, mapping.packageBaseUnitId);
    }
  }

  const retailerProductIds = [...new Set(lines.map(line => line.retailerProductId).filter((id): id is string => Boolean(id)))];
  const exportAllocations: PlannerExportAllocation[] = [];
  for (const retailerProductId of retailerProductIds) {
    const active = exportsActiveAt(installation.id, retailerProductId, receipt.purchasedAt);
    for (const allocation of listAllocations(active.map(row => row.id))) {
      exportAllocations.push({
        exportId: allocation.exportId,
        retailerProductId,
        mealieItemId: allocation.mealieItemId,
        revisionId: allocation.demandRevisionId,
        targetKind: allocation.targetKind as TargetKind,
        targetId: allocation.targetId,
        baseAmount: allocation.baseAmount,
      });
    }
  }

  const demandRows = new Map(db.select().from(demands).all().map(row => [row.mealieItemId, row]));
  const demand: PlannerDemand[] = [];
  for (const item of items) {
    if (item.checked) continue;
    const target = demandTargetFor(item, ctx, mealieBaseUnits);
    if (!target) continue;
    const quantity = Number(item.quantity ?? 0) > 0 ? Number(item.quantity) : 1;
    demand.push({
      mealieItemId: item.id,
      ...target,
      rowQuantity: quantity,
      rowIdentity: rowIdentityOf(item),
      purchaseRevision: purchaseRevisionFor(item.id, receipt.purchasedAt, graceMs),
      ownReductionsSincePurchase: ownReductionsSince(item.id, receipt.purchasedAt),
      firstSeenAt: demandRows.get(item.id)?.firstSeenAt ?? new Date(),
    });
  }

  return {
    receipt: { id: receipt.id, purchasedAt: receipt.purchasedAt, fetchedAt: receipt.fetchedAt },
    lines: lines.map(line => ({
      id: line.id,
      lineNo: line.lineNo,
      kind: line.kind,
      retailerProductId: line.retailerProductId,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      amountCents: line.amountCents,
    })),
    mappings,
    exportAllocations,
    lifecycles: lifecyclesForProducts(installation.id, retailerProductIds),
    demand,
  };
}

// ---------------------------------------------------------------------------
// Plan persistence
// ---------------------------------------------------------------------------

export function grocyAddEffectKey(lineId: string): string {
  return `receipt:${lineId}:grocy_add`;
}

export function persistReceiptPlan(
  receipt: ReceiptRow,
  installation: PluginInstallation,
  plan: ReceiptPlan,
  shoppingListId: string,
  now: Date,
): void {
  db.transaction((tx) => {
    const addEffectByLine = new Map<string, string>();
    for (const line of plan.lines) {
      tx.update(receiptLines).set({
        status: line.status,
        reviewReason: line.reviewReason ?? null,
      }).where(eq(receiptLines.id, line.lineId)).run();
      if (line.status !== 'planned' || !line.target) continue;

      if (line.target.kind === 'grocy_product' && line.bookAmount > 0) {
        const effect = ensureEffect<GrocyAddPayload>({
          effectKey: grocyAddEffectKey(line.lineId),
          kind: 'grocy_add',
          sourceKind: 'receipt',
          sourceRef: receipt.id,
          payload: {
            productId: Number(line.target.id),
            amount: line.bookAmount,
            ...(line.unitPrice !== null ? { price: line.unitPrice } : {}),
            ...(installation.settings.grocyShoppingLocationId ? { shoppingLocationId: installation.settings.grocyShoppingLocationId } : {}),
            label: line.target.name,
          },
        }, now, tx);
        addEffectByLine.set(line.lineId, effect.id);
      }
      for (const credit of line.credits) {
        insertLink(tx, line.lineId, 'credit', {
          lifecycleId: credit.lifecycleId, mealieItemId: credit.mealieItemId, targetKind: line.target.kind,
          targetId: line.target.id, baseAmount: credit.amount, effectId: credit.bookingEffectId,
        }, now);
      }
      if (line.extraAmount > 0) {
        insertLink(tx, line.lineId, 'extra', {
          targetKind: line.target.kind, targetId: line.target.id, baseAmount: line.extraAmount, effectId: addEffectByLine.get(line.lineId) ?? null,
        }, now);
      }
      for (const discrepancy of line.discrepancies) {
        tx.insert(discrepancies).values({
          id: randomUUID(),
          kind: discrepancy.kind,
          status: 'open',
          receiptLineId: line.lineId,
          lifecycleId: discrepancy.lifecycleId,
          evidenceJson: JSON.stringify({ ...discrepancy, receiptId: receipt.id, externalReceiptId: receipt.externalReceiptId }),
          createdAt: now,
        }).onConflictDoNothing().run();
      }
    }

    for (const reduction of plan.reductions) {
      const lineIds = reduction.lineIds;
      const effect = ensureEffect<MealieReducePayload & { dependsOnEffects: string[] }>({
        // Keyed by the lines it serves, so re-planning a reviewed line never collides with an earlier reduction.
        effectKey: `receipt:${receipt.id}:mealie_reduce:${reduction.mealieItemId}:${[...lineIds].sort().join(',')}`,
        kind: 'mealie_reduce',
        sourceKind: 'receipt',
        sourceRef: receipt.id,
        payload: {
          itemId: reduction.mealieItemId,
          shoppingListId,
          expectedBefore: reduction.rowQuantityBefore,
          expectedAfter: reduction.rowQuantityAfter,
          expectedIdentity: reduction.rowIdentity,
          dependsOnEffects: lineIds.map(lineId => addEffectByLine.get(lineId)).filter((id): id is string => Boolean(id)),
          label: `Mealie row ${reduction.mealieItemId}`,
        },
      }, now, tx);
      for (const line of plan.lines) {
        for (const allocation of line.allocations.filter(candidate => candidate.mealieItemId === reduction.mealieItemId)) {
          insertLink(tx, line.lineId, 'allocation', {
            mealieItemId: allocation.mealieItemId, demandRevisionId: allocation.revisionId, exportId: allocation.exportId,
            targetKind: line.target?.kind ?? null, targetId: line.target?.id ?? null, baseAmount: allocation.baseAmount, effectId: effect.id,
          }, now);
        }
      }
    }

    // A later receipt that covers an earlier over-booking settles that discrepancy.
    for (const line of plan.lines) {
      for (const credit of line.credits) {
        const open = tx.select().from(discrepancies)
          .where(and(eq(discrepancies.lifecycleId, credit.lifecycleId), eq(discrepancies.status, 'open'), eq(discrepancies.kind, 'over_booked_manual_check')))
          .all();
        for (const discrepancy of open) {
          if (discrepancy.receiptLineId === line.lineId) continue;
          tx.update(discrepancies).set({ status: 'resolved', resolution: 'covered_by_later_receipt', resolvedAt: now })
            .where(eq(discrepancies.id, discrepancy.id)).run();
        }
      }
    }

    tx.update(receipts).set({ status: 'planned' }).where(eq(receipts.id, receipt.id)).run();
  });
}

function insertLink(
  tx: LedgerTx,
  receiptLineId: string,
  kind: 'credit' | 'allocation' | 'extra' | 'substitution',
  values: {
    lifecycleId?: string | null;
    demandRevisionId?: string | null;
    mealieItemId?: string | null;
    exportId?: string | null;
    targetKind?: string | null;
    targetId?: string | null;
    baseAmount: number;
    effectId?: string | null;
  },
  now: Date,
): void {
  tx.insert(reconciliationLinks).values({
    id: randomUUID(),
    receiptLineId,
    kind,
    lifecycleId: values.lifecycleId ?? null,
    demandRevisionId: values.demandRevisionId ?? null,
    mealieItemId: values.mealieItemId ?? null,
    exportId: values.exportId ?? null,
    targetKind: values.targetKind ?? null,
    targetId: values.targetId ?? null,
    baseAmount: values.baseAmount,
    effectId: values.effectId ?? null,
    createdAt: now,
  }).run();
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

/** Settle uncertain receipt effects with definitive evidence only. */
export async function verifyUncertainShopEffects(runner: EffectRunnerDeps, summary: ReconcileSummary): Promise<void> {
  const unknown = listEffects({ statuses: ['unknown'] })
    .filter(effect => effect.sourceKind === 'receipt' || effect.sourceKind === 'substitution');
  for (const effect of unknown) {
    if (effect.kind === 'grocy_add') {
      if (await verifyGrocyAddEffect(effect as unknown as ShopEffect<GrocyAddPayload>, runner) === 'applied') summary.verified++;
    } else if (effect.kind === 'mealie_reduce') {
      const status = await runMealieReduceEffect(effect as unknown as ShopEffect<MealieReducePayload>, runner);
      if (status !== 'unknown') summary.verified++;
    }
  }
}

async function executeReceiptEffects(receiptId: string, runner: EffectRunnerDeps, summary: ReconcileSummary, budget: { remaining: number }): Promise<void> {
  const effects = receiptEffects(receiptId);
  const statusById = new Map(effects.map(effect => [effect.id, effect.status]));
  const runnable = (effect: ShopEffect) =>
    (effect.status === 'planned' || effect.status === 'not_applied') && effect.attempts < MAX_DEFINITE_FAILURE_ATTEMPTS;

  for (const effect of effects.filter(candidate => candidate.kind === 'grocy_add' && runnable(candidate))) {
    if (budget.remaining-- <= 0) return;
    const status = await runGrocyAddEffect(effect as unknown as ShopEffect<GrocyAddPayload>, runner);
    statusById.set(effect.id, status);
    countStatus(summary, status);
  }
  for (const effect of effects.filter(candidate => candidate.kind === 'mealie_reduce' && runnable(candidate))) {
    const dependsOn = ((effect.payload as { dependsOnEffects?: string[] }).dependsOnEffects ?? []);
    // Reductions wait while a booking they depend on is not settled. A purchase the user
    // chose not to book (cancelled) still fulfils the demand.
    if (dependsOn.some(id => !['applied', 'cancelled'].includes(statusById.get(id) ?? 'planned'))) continue;
    if (budget.remaining-- <= 0) return;
    const status = await runMealieReduceEffect(effect as unknown as ShopEffect<MealieReducePayload>, runner);
    statusById.set(effect.id, status);
    countStatus(summary, status);
  }
}

function countStatus(summary: ReconcileSummary, status: EffectStatus): void {
  if (status === 'applied' || status === 'superseded') summary.applied++;
  else if (status === 'unknown') summary.unknown++;
  else if (status === 'not_applied') summary.failed++;
}

function settleReceiptStatus(receipt: ReceiptRow, now: Date): 'processed' | 'needs_review' | 'planned' {
  if (hasOpenEffects(receipt.id)) return 'planned';
  // Finish the original plan without approving the retailer's amended contents.
  if (receipt.status === 'changed') return 'needs_review';
  const reviewLines = getReceiptLines(receipt.id).filter(line => line.status === 'review');
  const status = reviewLines.length > 0 ? 'needs_review' : 'processed';
  setReceiptStatus(receipt.id, status, now);
  return status;
}

/**
 * One reconciliation pass. Runs under the sync lock. Receipts are planned in
 * purchase order, and a receipt is only planned once every earlier receipt's
 * effects settled, so each plan sees the reductions of the ones before it.
 */
export async function runShopReconcile(deps: ReconcileDeps): Promise<ReconcileResult> {
  const summary = emptySummary();
  const events: HistoryEventInput[] = [];
  const now = deps.now();
  recoverInterruptedEffects(now);
  await verifyUncertainShopEffects(deps.runner, summary);

  const candidates = listReceipts({ statuses: ['stored', 'planned', 'changed'] })
    .filter(receipt => receipt.status !== 'changed' || hasOpenEffects(receipt.id));
  if (candidates.length === 0) return { status: 'ok', summary, events };
  if (!deps.shoppingListId && candidates.every(receipt => receipt.status === 'stored')) {
    return { status: 'skipped', summary, events, message: 'No Mealie shopping list configured' };
  }

  let items: MealieShoppingItem[] | null = null;
  let ctx: UnitContext | null = null;
  const budget = { remaining: MAX_EFFECTS_PER_RUN };

  for (const receipt of candidates) {
    const installation = getInstallation(receipt.installationId);
    if (receipt.status === 'stored') {
      // Disabling receipt intake stops new plans. Durable plans already accepted
      // by the core still settle, using their original payloads and dependencies.
      if (!installation || installation.revokedAt || !installation.settings.receiptsEnabled || !deps.shoppingListId) continue;
      // Plan only after every earlier receipt settled; their reductions must be visible first.
      const earlierOpen = listReceipts({ statuses: ['planned', 'changed'] })
        .some(other => other.id !== receipt.id && other.purchasedAt.getTime() <= receipt.purchasedAt.getTime() && hasOpenEffects(other.id));
      if (earlierOpen) break;
      items ??= await deps.loadMealieItems(deps.shoppingListId);
      ctx ??= await deps.loadUnitContext();
      const input = await buildPlannerInput(receipt, installation, items, ctx, deps.observationGraceMs);
      const plan = planReceipt(input);
      persistReceiptPlan(receipt, installation, plan, deps.shoppingListId, now);
      summary.planned++;
      for (const line of plan.lines.filter(candidate => candidate.status === 'review')) {
        events.push(activityEvent({
          level: 'warning', source: 'App', target: 'Grocy', category: 'shopping', entityKind: 'system', entityRef: `receipt-line:${line.lineId}`,
          message: `A receipt line needs review (${line.reviewReason}).`,
          reason: 'Unknown or unconfirmed receipt lines are never booked automatically.',
          details: { receiptId: receipt.id, lineId: line.lineId, reason: line.reviewReason },
        }));
      }
      for (const discrepancy of plan.lines.flatMap(line => line.discrepancies)) {
        events.push(activityEvent({
          level: 'warning', source: 'App', target: 'Grocy', category: 'inventory', entityKind: 'system', entityRef: `lifecycle:${discrepancy.lifecycleId}`,
          message: `A manual check booked ${discrepancy.bookedAmount}, but the receipt shows ${discrepancy.receiptAmount}.`,
          reason: 'Review the discrepancy on the Shopping page.',
          details: { ...discrepancy },
        }));
      }
      // The plan changed the live picture; reload rows for the next receipt.
      items = null;
    }

    await executeReceiptEffects(receipt.id, deps.runner, summary, budget);
    const settled = settleReceiptStatus(receipt, now);
    if (settled === 'processed') summary.processedReceipts++;
    if (settled === 'needs_review') summary.reviewReceipts++;
    if (settled === 'planned') break;
    if (budget.remaining <= 0) break;
  }

  if (summary.applied > 0) {
    events.push(activityEvent({
      source: 'App', target: 'Grocy', category: 'inventory', entityKind: 'system', entityRef: 'shop-receipts',
      message: `Processed receipt purchases: ${summary.applied} booking(s) and list update(s) applied.`,
      reason: 'Receipts from connected shop plugins are reconciled with Grocy and Mealie.',
      details: { ...summary },
    }));
  }
  if (summary.unknown > 0) {
    events.push(activityEvent({
      level: 'warning', source: 'App', target: 'Grocy', category: 'inventory', entityKind: 'system', entityRef: 'shop-receipts-unknown',
      message: `${summary.unknown} receipt write(s) have an unknown outcome and will not be retried automatically.`,
      reason: 'Review them on the Shopping page.',
      details: { ...summary },
    }));
  }
  return { status: summary.unknown > 0 || summary.failed > 0 ? 'partial' : 'ok', summary, events };
}

export function defaultReconcileRunner(): EffectRunnerDeps {
  return defaultEffectRunnerDeps;
}

import type { ListOp, ListOpResult, ShopList } from '../plugins/protocol/v1';

/**
 * Pure planning of shared shopping list writes.
 *
 * gm-sync only touches lines it has an ownership record for. Quantities alone
 * cannot tell whose units disappeared, so any unexplained reduction pauses all
 * destructive operations (and re-adds) for that line until the user decides.
 * Units added by others are always kept. Duplicate lines for one product, or a
 * remembered line that now holds another product, also pause instead of
 * editing whichever line happens to match first.
 */

export interface LineRecord {
  retailerProductId: string;
  lineId: string | null;
  managedQty: number;
  baselineUserQty: number;
  lastWrittenQty: number;
  pausedReason: PauseReason | null;
  pausedObservedQty: number | null;
  /** Export version that was current when the user released the line. */
  releasedExportId: string | null;
}

export type PauseReason = 'reduced_by_other' | 'line_missing' | 'duplicate_lines' | 'line_reused' | 'released';

export interface DesiredLine {
  packages: number;
  exportId: string | null;
}

export interface PlannedOp {
  retailerProductId: string;
  op: ListOp;
  /** Record state to commit once the plugin reports the op as applied. */
  onApplied: LineRecord | null;
}

export interface ListSyncPlan {
  ops: PlannedOp[];
  /** Record changes that need no list write (baselines raised, pauses). */
  immediate: Array<{ retailerProductId: string; record: LineRecord | null }>;
}

function emptyRecord(retailerProductId: string): LineRecord {
  return {
    retailerProductId,
    lineId: null,
    managedQty: 0,
    baselineUserQty: 0,
    lastWrittenQty: 0,
    pausedReason: null,
    pausedObservedQty: null,
    releasedExportId: null,
  };
}

function linesForProduct(list: ShopList, retailerProductId: string) {
  return list.lines.filter(line => line.retailerProductId === retailerProductId);
}

/** Plan adopting or adding a product that has no (active) ownership record. */
function planFresh(plan: ListSyncPlan, list: ShopList, retailerProductId: string, wanted: number): void {
  const matches = linesForProduct(list, retailerProductId);
  if (matches.length > 1) {
    plan.immediate.push({
      retailerProductId,
      record: {
        ...emptyRecord(retailerProductId),
        pausedReason: 'duplicate_lines',
        pausedObservedQty: matches.reduce((sum, line) => sum + line.quantity, 0),
      },
    });
    return;
  }
  const [existing] = matches;
  if (existing) {
    // Someone already listed this product: their quantity becomes the baseline we never touch.
    const target = existing.quantity + wanted;
    plan.ops.push({
      retailerProductId,
      op: { op: 'set', lineId: existing.lineId, quantity: target, expectedQuantity: existing.quantity },
      onApplied: { ...emptyRecord(retailerProductId), lineId: existing.lineId, managedQty: wanted, baselineUserQty: existing.quantity, lastWrittenQty: target },
    });
    return;
  }
  plan.ops.push({
    retailerProductId,
    op: { op: 'add', retailerProductId, quantity: wanted },
    onApplied: { ...emptyRecord(retailerProductId), managedQty: wanted, lastWrittenQty: wanted },
  });
}

export function planListSync(records: LineRecord[], desired: Map<string, DesiredLine>, list: ShopList): ListSyncPlan {
  const plan: ListSyncPlan = { ops: [], immediate: [] };
  const recordsByProduct = new Map(records.map(record => [record.retailerProductId, record]));
  const products = new Set([
    ...recordsByProduct.keys(),
    ...[...desired.entries()].filter(([, line]) => line.packages > 0).map(([id]) => id),
  ]);

  for (const retailerProductId of [...products].sort()) {
    const desiredLine = desired.get(retailerProductId);
    const wanted = Math.max(0, Math.round(desiredLine?.packages ?? 0));
    const record = recordsByProduct.get(retailerProductId);

    if (!record) {
      if (wanted > 0) planFresh(plan, list, retailerProductId, wanted);
      continue;
    }

    if (record.pausedReason === 'released') {
      // A released line stays the user's until new demand produces a newer export.
      if (wanted > 0 && desiredLine?.exportId && desiredLine.exportId !== record.releasedExportId) {
        plan.immediate.push({ retailerProductId, record: null });
        planFresh(plan, list, retailerProductId, wanted);
      }
      continue;
    }
    if (record.pausedReason) continue;

    let line = record.lineId ? list.lines.find(candidate => candidate.lineId === record.lineId) ?? null : null;
    if (!record.lineId) {
      const matches = linesForProduct(list, retailerProductId);
      if (matches.length > 1) {
        plan.immediate.push({ retailerProductId, record: { ...record, pausedReason: 'duplicate_lines', pausedObservedQty: matches.reduce((sum, candidate) => sum + candidate.quantity, 0) } });
        continue;
      }
      line = matches[0] ?? null;
    }
    if (line && line.retailerProductId !== retailerProductId) {
      plan.immediate.push({ retailerProductId, record: { ...record, pausedReason: 'line_reused', pausedObservedQty: line.quantity } });
      continue;
    }

    if (!line) {
      if (record.lastWrittenQty === 0 && record.baselineUserQty === 0) {
        if (wanted === 0) {
          plan.immediate.push({ retailerProductId, record: null });
        } else {
          planFresh(plan, list, retailerProductId, wanted);
        }
        continue;
      }
      plan.immediate.push({ retailerProductId, record: { ...record, pausedReason: 'line_missing', pausedObservedQty: 0 } });
      continue;
    }

    let baseline = record.baselineUserQty;
    const observed = line.quantity;
    if (observed < record.lastWrittenQty) {
      plan.immediate.push({ retailerProductId, record: { ...record, lineId: line.lineId, pausedReason: 'reduced_by_other', pausedObservedQty: observed } });
      continue;
    }
    if (observed > record.lastWrittenQty) {
      baseline += observed - record.lastWrittenQty;
    }
    const target = baseline + wanted;
    const next: LineRecord = { ...record, lineId: line.lineId, baselineUserQty: baseline, lastWrittenQty: observed };

    if (target === observed) {
      if (wanted === 0 && baseline > 0) {
        // Only the user's own units remain: stop managing their line.
        plan.immediate.push({ retailerProductId, record: null });
      } else if (next.baselineUserQty !== record.baselineUserQty || next.lineId !== record.lineId || record.managedQty !== wanted || record.lastWrittenQty !== observed) {
        plan.immediate.push({ retailerProductId, record: { ...next, managedQty: wanted } });
      }
      continue;
    }
    if (target === 0) {
      plan.ops.push({
        retailerProductId,
        op: { op: 'remove', lineId: line.lineId, expectedQuantity: observed },
        onApplied: null,
      });
      continue;
    }
    plan.ops.push({
      retailerProductId,
      op: { op: 'set', lineId: line.lineId, quantity: target, expectedQuantity: observed },
      onApplied: wanted === 0 ? null : { ...next, managedQty: wanted, lastWrittenQty: target },
    });
  }
  return plan;
}

/**
 * Validate a list.apply answer: one result per requested op, each index
 * exactly once. Anything else leaves the outcome unknown.
 */
export function validateApplyResults(opCount: number, results: ListOpResult[]): boolean {
  if (results.length !== opCount) return false;
  const seen = new Set<number>();
  for (const result of results) {
    if (result.index < 0 || result.index >= opCount || seen.has(result.index)) return false;
    seen.add(result.index);
  }
  return true;
}

/** Commit planned record changes according to per-op plugin results. */
export function recordsAfterApply(plan: ListSyncPlan, results: ListOpResult[]): Array<{ retailerProductId: string; record: LineRecord | null }> {
  const updates: Array<{ retailerProductId: string; record: LineRecord | null }> = [];
  plan.ops.forEach((planned, index) => {
    const result = results.find(candidate => candidate.index === index);
    if (result?.status !== 'applied') return;
    const record = planned.onApplied ? { ...planned.onApplied, lineId: result.lineId ?? planned.onApplied.lineId } : null;
    updates.push({ retailerProductId: planned.retailerProductId, record });
  });
  return updates;
}

export type PauseResolution = 'user_units_removed' | 'readd' | 'release';

/**
 * Resolve a paused line with the user's explanation.
 * - user_units_removed: someone removed their own units; keep ours.
 * - readd: our units were taken (or removed by mistake); write them again.
 * - release: the line is the user's; it is not touched again until new demand
 *   produces a newer export version than `currentExportId`.
 */
export function resolvePausedLine(record: LineRecord, resolution: PauseResolution, currentExportId: string | null): LineRecord {
  if (resolution === 'release') {
    return { ...emptyRecord(record.retailerProductId), pausedReason: 'released', releasedExportId: currentExportId };
  }
  if (record.pausedReason === 'duplicate_lines' || record.pausedReason === 'line_reused') {
    // Only releasing (or merging the lines in the shop app) settles these.
    return record;
  }
  const observed = record.pausedObservedQty ?? 0;
  const lineId = observed > 0 ? record.lineId : null;
  if (resolution === 'user_units_removed') {
    return { ...record, lineId, baselineUserQty: Math.max(0, observed - record.managedQty), lastWrittenQty: observed, pausedReason: null, pausedObservedQty: null };
  }
  return { ...record, lineId, baselineUserQty: Math.min(record.baselineUserQty, observed), lastWrittenQty: observed, pausedReason: null, pausedObservedQty: null };
}

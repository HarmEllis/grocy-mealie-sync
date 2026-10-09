import type { ListOp, ListOpResult, ShopList } from '../plugins/protocol/v1';

/**
 * Pure planning of shared shopping list writes.
 *
 * gm-sync only touches lines it has an ownership record for. Quantities alone
 * cannot tell whose units disappeared from a reduced line, so unexplained
 * reductions pause that line until the user decides. Missing product lines
 * are restored from current Mealie demand, without restoring household units.
 * Units added by others are always kept. Duplicate lines for one product, or a
 * remembered line that now holds another product, also pause instead of
 * editing whichever line happens to match first.
 */

export type LineKind = 'product' | 'note';

export interface LineRecord {
  retailerProductId: string;
  /** `note`: the free-text note standing in for a discontinued retailer product. */
  kind: LineKind;
  /** Exact text of an owned note, or the note that is waiting for plugin support. */
  noteText: string | null;
  lineId: string | null;
  managedQty: number;
  baselineUserQty: number;
  lastWrittenQty: number;
  pausedReason: PauseReason | null;
  pausedObservedQty: number | null;
  /** Export version that was current when the user released the line. */
  releasedExportId: string | null;
}

/**
 * `notes_unsupported`: the product is discontinued, but the plugin cannot write
 * a replacement note. Nothing is sent; the line waits for review or a plugin
 * update. Only `release` resolves it by hand.
 */
// `line_missing` is legacy state; missing product lines now recover automatically.
export type PauseReason = 'reduced_by_other' | 'line_missing' | 'duplicate_lines' | 'line_reused' | 'released' | 'notes_unsupported';

export interface DesiredLine {
  packages: number;
  exportId: string | null;
}

/** A free-text note that should stand in for a discontinued product's export. */
export interface DesiredNote {
  text: string;
  exportId: string | null;
}

export interface PlannedOp {
  retailerProductId: string;
  kind: LineKind;
  op: ListOp;
  /** Explanation retained across retries for the confirmed history event. */
  auditReason?: string;
  /** Record state to commit once the plugin reports the op as applied. */
  onApplied: LineRecord | null;
  /** Record state to commit on `conflict`; undefined keeps the record unchanged. */
  onConflict?: LineRecord | null;
}

export interface RecordUpdate {
  retailerProductId: string;
  kind: LineKind;
  record: LineRecord | null;
}

export interface ListSyncPlan {
  ops: PlannedOp[];
  /** Record changes that need no list write (baselines raised, pauses). */
  immediate: RecordUpdate[];
}

function emptyRecord(retailerProductId: string, kind: LineKind = 'product'): LineRecord {
  return {
    retailerProductId,
    kind,
    noteText: null,
    lineId: null,
    managedQty: 0,
    baselineUserQty: 0,
    lastWrittenQty: 0,
    pausedReason: null,
    pausedObservedQty: null,
    releasedExportId: null,
  };
}

function productUpdate(retailerProductId: string, record: LineRecord | null): RecordUpdate {
  return { retailerProductId, kind: 'product', record };
}

function linesForProduct(list: ShopList, retailerProductId: string) {
  return list.lines.filter(line => line.retailerProductId === retailerProductId);
}

/** Plan adopting or adding a product that has no (active) ownership record. */
function planFresh(plan: ListSyncPlan, list: ShopList, retailerProductId: string, wanted: number, auditReason?: string): void {
  const matches = linesForProduct(list, retailerProductId);
  if (matches.length > 1) {
    plan.immediate.push({ retailerProductId, kind: 'product', record: {
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
      kind: 'product',
      op: { op: 'set', lineId: existing.lineId, quantity: target, expectedQuantity: existing.quantity },
      auditReason,
      onApplied: { ...emptyRecord(retailerProductId), lineId: existing.lineId, managedQty: wanted, baselineUserQty: existing.quantity, lastWrittenQty: target },
    });
    return;
  }
  plan.ops.push({
    retailerProductId,
    kind: 'product',
    op: { op: 'add', retailerProductId, quantity: wanted },
    auditReason,
    onApplied: { ...emptyRecord(retailerProductId), managedQty: wanted, lastWrittenQty: wanted },
  });
}

export interface NotePlanOptions {
  desiredNotes?: Map<string, DesiredNote>;
  /** The plugin advertised the `list.notes` feature. */
  notesSupported?: boolean;
}

export function planListSync(records: LineRecord[], desired: Map<string, DesiredLine>, list: ShopList, notes: NotePlanOptions = {}): ListSyncPlan {
  const plan: ListSyncPlan = { ops: [], immediate: [] };
  const noteRecords = records.filter(record => record.kind === 'note');
  const productRecords = records.filter(record => record.kind !== 'note');
  // Product -> note and note -> product are staged: the new representation is
  // only added once the managed old one is gone in a confirmed read, so failed
  // or uncertain writes can never leave two managed lines for one demand.
  const managedProducts = new Set(productRecords.filter(record => record.pausedReason !== 'released' && !((desired.get(record.retailerProductId)?.packages ?? 0) === 0 && record.baselineUserQty === 0 && linesForProduct(list, record.retailerProductId).length === 0)).map(record => record.retailerProductId));
  const ownedNotes = new Set(noteRecords.filter(record => record.lineId && !record.pausedReason).map(record => record.retailerProductId));
  planNotes(plan, noteRecords, notes.desiredNotes ?? new Map(), list, Boolean(notes.notesSupported), managedProducts);
  const recordsByProduct = new Map(productRecords.map(record => [record.retailerProductId, record]));
  const products = new Set([
    ...recordsByProduct.keys(),
    ...[...desired.entries()].filter(([, line]) => line.packages > 0).map(([id]) => id),
  ]);

  for (const retailerProductId of [...products].sort()) {
    const desiredLine = desired.get(retailerProductId);
    const wanted = Math.max(0, Math.round(desiredLine?.packages ?? 0));
    const record = recordsByProduct.get(retailerProductId);

    const replacedByNote = ownedNotes.has(retailerProductId);
    if (!record) {
      if (wanted > 0 && !replacedByNote) planFresh(plan, list, retailerProductId, wanted);
      continue;
    }

    if (record.pausedReason === 'released') {
      // A released line stays the user's until new demand produces a newer export.
      if (wanted > 0 && !replacedByNote && desiredLine?.exportId && desiredLine.exportId !== record.releasedExportId) {
        plan.immediate.push({ retailerProductId, kind: 'product', record: null });
        planFresh(plan, list, retailerProductId, wanted);
      }
      continue;
    }
    if (wanted === 0 && record.baselineUserQty === 0 && linesForProduct(list, retailerProductId).length === 0) {
      plan.immediate.push({ retailerProductId, kind: 'product', record: null });
      continue;
    }
    // Older versions paused missing lines. Reconcile these from current demand too.
    if (record.pausedReason && record.pausedReason !== 'line_missing') continue;

    let line = record.lineId ? list.lines.find(candidate => candidate.lineId === record.lineId) ?? null : null;
    if (!record.lineId) {
      const matches = linesForProduct(list, retailerProductId);
      if (matches.length > 1) {
        plan.immediate.push({ retailerProductId, kind: 'product', record: { ...record, pausedReason: 'duplicate_lines', pausedObservedQty: matches.reduce((sum, candidate) => sum + candidate.quantity, 0) } });
        continue;
      }
      line = matches[0] ?? null;
    }
    if (line && line.retailerProductId !== retailerProductId) {
      plan.immediate.push({ retailerProductId, kind: 'product', record: { ...record, pausedReason: 'line_reused', pausedObservedQty: line.quantity } });
      continue;
    }

    if (!line) {
      if (wanted === 0) {
        plan.immediate.push({ retailerProductId, kind: 'product', record: null });
      } else if (!replacedByNote) {
        // The retailer list is a projection of Mealie demand. A deletion there
        // does not cancel it; adopt any replacement line using a fresh baseline.
        planFresh(plan, list, retailerProductId, wanted, 'The managed product line disappeared from the retailer list. It was restored because Mealie still needs it.');
      }
      continue;
    }

    let baseline = record.baselineUserQty;
    const observed = line.quantity;
    if (observed < record.lastWrittenQty) {
      plan.immediate.push({ retailerProductId, kind: 'product', record: { ...record, lineId: line.lineId, pausedReason: 'reduced_by_other', pausedObservedQty: observed } });
      continue;
    }
    if (observed > record.lastWrittenQty) {
      baseline += observed - record.lastWrittenQty;
    }
    const target = baseline + wanted;
    const next: LineRecord = { ...record, lineId: line.lineId, baselineUserQty: baseline, lastWrittenQty: observed, pausedReason: null, pausedObservedQty: null };

    if (target === observed) {
      if (wanted === 0 && baseline > 0) {
        // Only the user's own units remain: stop managing their line.
        plan.immediate.push({ retailerProductId, kind: 'product', record: null });
      } else if (record.pausedReason || next.baselineUserQty !== record.baselineUserQty || next.lineId !== record.lineId || record.managedQty !== wanted || record.lastWrittenQty !== observed) {
        plan.immediate.push({ retailerProductId, kind: 'product', record: { ...next, managedQty: wanted } });
      }
      continue;
    }
    if (target === 0) {
      plan.ops.push({
        retailerProductId,
        kind: 'product',
        op: { op: 'remove', lineId: line.lineId, expectedQuantity: observed },
        onApplied: null,
      });
      continue;
    }
    plan.ops.push({
      retailerProductId,
      kind: 'product',
      op: { op: 'set', lineId: line.lineId, quantity: target, expectedQuantity: observed },
      onApplied: wanted === 0 ? null : { ...next, managedQty: wanted, lastWrittenQty: target },
    });
  }
  return plan;
}

/** Notes are identified by their text, compared like retailers do: trimmed, case- and spacing-insensitive. */
export function normalizeNoteText(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function noteLines(list: ShopList) {
  return list.lines.filter(line => line.retailerProductId === null);
}

/**
 * Plan the free-text notes that stand in for discontinued products.
 *
 * gm-sync adds a note only when no note with the same text exists, and from
 * then on owns exactly that line. A note someone else wrote, even with the
 * same text, is never claimed or removed. When our note is removed or edited
 * by someone else it is released: it is not added again until the demand
 * changes. A note is replaced when the wanted text changes: removed in one
 * sync, added in a later one.
 */
function planNotes(plan: ListSyncPlan, records: LineRecord[], desired: Map<string, DesiredNote>, list: ShopList, supported: boolean, managedProducts: Set<string>): void {
  const recordsByProduct = new Map(records.map(record => [record.retailerProductId, record]));
  const update = (retailerProductId: string, record: LineRecord | null) => plan.immediate.push({ retailerProductId, kind: 'note', record });
  const textInUse = (text: string) => noteLines(list).some(line => normalizeNoteText(line.description) === normalizeNoteText(text));
  const ownedRecord = (retailerProductId: string, text: string): LineRecord => ({
    ...emptyRecord(retailerProductId, 'note'), noteText: text, managedQty: 1, lastWrittenQty: 1,
  });
  const addNote = (retailerProductId: string, text: string) => {
    plan.ops.push({ retailerProductId, kind: 'note', op: { op: 'add_note', text }, onApplied: ownedRecord(retailerProductId, text) });
  };

  for (const retailerProductId of [...new Set([...recordsByProduct.keys(), ...desired.keys()])].sort()) {
    const want = desired.get(retailerProductId);
    const record = recordsByProduct.get(retailerProductId);
    const owned = record && record.lineId && !record.pausedReason ? record : null;

    if (!owned) {
      if (record?.pausedReason === 'released' && want && (!want.exportId || want.exportId === record.releasedExportId)) continue;
      if (!want) {
        if (record) update(retailerProductId, null);
        continue;
      }
      // Our product line must be retired first; its removal is planned in this same sync.
      if (managedProducts.has(retailerProductId)) continue;
      if (!supported) {
        // Never fall back to a different product; surface the gap instead.
        if (record?.pausedReason !== 'notes_unsupported' || record.noteText !== want.text) {
          update(retailerProductId, { ...emptyRecord(retailerProductId, 'note'), noteText: want.text, pausedReason: 'notes_unsupported' });
        }
        continue;
      }
      if (record) update(retailerProductId, null);
      // The same text already listed by someone else covers the demand; it is never adopted.
      if (!textInUse(want.text)) addNote(retailerProductId, want.text);
      continue;
    }

    const line = list.lines.find(candidate => candidate.lineId === owned.lineId);
    if (!line || line.retailerProductId !== null || normalizeNoteText(line.description) !== normalizeNoteText(owned.noteText ?? '')) {
      update(retailerProductId, { ...emptyRecord(retailerProductId, 'note'), pausedReason: 'released', releasedExportId: want?.exportId ?? null });
      continue;
    }
    if (want && normalizeNoteText(want.text) === normalizeNoteText(owned.noteText ?? '')) continue;
    if (!supported) continue; // Our note stays until the plugin can remove it again.
    // A changed amount replaces the note in two syncs: remove now, add after a
    // confirmed read shows it gone. A failed removal keeps ownership and blocks
    // the add; a conflicting one releases the old note to the user instead.
    plan.ops.push({
      retailerProductId,
      kind: 'note',
      op: { op: 'remove_note', lineId: line.lineId, expectedText: owned.noteText! },
      onApplied: null,
      onConflict: want ? { ...emptyRecord(retailerProductId, 'note'), pausedReason: 'released', releasedExportId: want.exportId } : null,
    });
  }
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

/** Commit planned record changes according to per-op plugin results, in op order. */
export function recordsAfterApply(plan: ListSyncPlan, results: ListOpResult[]): RecordUpdate[] {
  const updates: RecordUpdate[] = [];
  plan.ops.forEach((planned, index) => {
    const result = results.find(candidate => candidate.index === index);
    const kind = planned.kind ?? 'product';
    if (result?.status === 'conflict' && planned.onConflict !== undefined) {
      updates.push({ retailerProductId: planned.retailerProductId, kind, record: planned.onConflict });
      return;
    }
    if (result?.status !== 'applied') return;
    if (planned.op.op === 'add_note' && !result.lineId) {
      // Without a line ID the note cannot be addressed later; leave it unowned instead of guessing.
      return;
    }
    const record = planned.onApplied ? { ...planned.onApplied, lineId: result.lineId ?? planned.onApplied.lineId } : null;
    updates.push({ retailerProductId: planned.retailerProductId, kind, record });
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
  if (record.kind === 'note') {
    // A waiting note has no units to explain; any decision releases it until the demand changes.
    return { ...emptyRecord(record.retailerProductId, 'note'), pausedReason: 'released', releasedExportId: currentExportId };
  }
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

import { recordHistoryRun, type HistoryEventInput } from '../history-store';
import { activityEvent } from '../sync/activity';
import { getRetailerMapping, getRetailerProduct, recordRetailerAvailability } from './retailer-catalog';
import { log } from '../logger';
import { randomUUID } from 'crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db';
import { appMeta, shopExportAllocations, shopExports, shopListLines } from '../db/schema';
import { acquireLease, releaseLease } from '../sync/mutex';
import type { ListApplyParams, ListApplyResult, ShopList } from '../plugins/protocol/v1';
import { PluginCallError } from '../plugins/gateway';
import { getInstallation, pinListId } from '../plugins/installations';
import { listActiveExports, type ShopExportRow } from './projection';
import { clearManualNotePreferences, manualNoteProductIds } from './note-preferences';
import { getLastListSync, recordListSync } from './status';
import {
  normalizeNoteText,
  planListSync,
  recordsAfterApply,
  resolvePausedLine,
  validateApplyResults,
  type DesiredLine,
  type DesiredNote,
  type LineKind,
  type LineRecord,
  type ListSyncPlan,
  type PauseReason,
  type PauseResolution,
} from './list-ownership';

export interface ListSyncDeps {
  readList: () => Promise<ShopList>;
  applyList: (params: ListApplyParams) => Promise<ListApplyResult>;
  now: () => Date;
  /** The connected plugin advertised `list.notes`. */
  notesSupported?: boolean;
}

export interface ListSyncResult {
  status: 'ok' | 'skipped' | 'pending_unknown' | 'list_changed' | 'error';
  applied: number;
  conflicts: number;
  failed: number;
  paused: number;
  /** Products the retailer refused because they are no longer sold; a note replaces them next time. */
  discontinued?: string[];
  message?: string;
  operationIssues?: Array<{ retailerProductId: string; operation: string; outcome: 'failed' | 'conflict'; reason: string }>;
}

type LineRow = typeof shopListLines.$inferSelect;

const LEASE_TTL_MS = 120_000;

declare global {
  // Installations with a list sync running in this process, shared across Next.js bundles.
  // eslint-disable-next-line no-var
  var __gmsShopListSyncRunning: Set<string> | undefined;
}

function runningSyncs(): Set<string> {
  globalThis.__gmsShopListSyncRunning ??= new Set();
  return globalThis.__gmsShopListSyncRunning;
}

function toRecord(row: LineRow): LineRecord {
  return {
    retailerProductId: row.retailerProductId,
    kind: row.kind === 'note' ? 'note' : 'product',
    noteText: row.noteText,
    lineId: row.lineId,
    managedQty: row.managedQty,
    baselineUserQty: row.baselineUserQty,
    lastWrittenQty: row.lastWrittenQty,
    pausedReason: row.pausedReason as PauseReason | null,
    pausedObservedQty: row.pausedObservedQty,
    releasedExportId: row.releasedExportId,
  };
}

export function listLineRecords(installationId: string): LineRow[] {
  return db.select().from(shopListLines).where(eq(shopListLines.installationId, installationId)).all();
}

function writeRecord(installationId: string, retailerProductId: string, kind: LineKind, record: LineRecord | null, now: Date): void {
  if (!record) {
    db.delete(shopListLines)
      .where(and(eq(shopListLines.installationId, installationId), eq(shopListLines.retailerProductId, retailerProductId), eq(shopListLines.kind, kind)))
      .run();
    return;
  }
  const values = {
    noteText: record.noteText,
    lineId: record.lineId,
    managedQty: record.managedQty,
    baselineUserQty: record.baselineUserQty,
    lastWrittenQty: record.lastWrittenQty,
    pausedReason: record.pausedReason,
    pausedObservedQty: record.pausedObservedQty,
    releasedExportId: record.releasedExportId,
    updatedAt: now,
  };
  db.insert(shopListLines)
    .values({ id: randomUUID(), installationId, retailerProductId, kind, ...values })
    .onConflictDoUpdate({ target: [shopListLines.installationId, shopListLines.retailerProductId, shopListLines.kind], set: values })
    .run();
}

interface PendingApply {
  params: ListApplyParams;
  plan: ListSyncPlan;
}

function pendingKey(installationId: string): string {
  return `shop-list-pending:${installationId}`;
}

function readPending(installationId: string): PendingApply | null {
  const row = db.select().from(appMeta).where(eq(appMeta.key, pendingKey(installationId))).get();
  if (!row) return null;
  try {
    return JSON.parse(row.value) as PendingApply;
  } catch {
    return null;
  }
}

function writePending(installationId: string, pending: PendingApply | null): void {
  if (!pending) {
    db.delete(appMeta).where(eq(appMeta.key, pendingKey(installationId))).run();
    return;
  }
  const value = JSON.stringify(pending);
  db.insert(appMeta).values({ key: pendingKey(installationId), value })
    .onConflictDoUpdate({ target: appMeta.key, set: { value } })
    .run();
}

export function getPendingListApply(installationId: string): PendingApply | null {
  return readPending(installationId);
}

/**
 * Send one list.apply. The operation is persisted before sending. Only a
 * complete, matching answer settles it; a lost, partial or mismatched answer
 * keeps it pending, and the identical opId is re-sent next time so the plugin
 * replays its cached result instead of applying twice.
 */
async function sendApply(installationId: string, pending: PendingApply, deps: ListSyncDeps, result: ListSyncResult, replay = false): Promise<boolean> {
  writePending(installationId, pending);
  let response: ListApplyResult;
  try {
    response = await deps.applyList(pending.params);
  } catch (error) {
    // A replay settles an earlier, uncertain attempt. Only the plugin itself can
    // say that attempt changed nothing; a local refusal (not connected, feature
    // missing after a plugin downgrade) says nothing about it.
    const localRefusal = error instanceof PluginCallError && (error.code === 'NOT_CONNECTED' || error.code === 'NOT_SUPPORTED');
    if (error instanceof PluginCallError && error.outcome === 'not_applied' && !(replay && localRefusal)) {
      writePending(installationId, null);
      result.status = 'error';
      result.message = error.message;
      return false;
    }
    result.status = 'pending_unknown';
    result.message = error instanceof Error ? error.message : String(error);
    return false;
  }
  if (
    response.opId !== pending.params.opId
    || response.list.listId !== pending.params.listId
    || !validateApplyResults(pending.params.ops.length, response.results)
  ) {
    result.status = 'pending_unknown';
    result.message = 'The plugin answered list.apply with a mismatched or incomplete result; the operation stays pending.';
    return false;
  }
  const now = deps.now();
  const installation = getInstallation(installationId);
  db.transaction(() => {
    for (const update of recordsAfterApply(pending.plan, response.results)) {
      writeRecord(installationId, update.retailerProductId, update.kind, update.record, now);
    }
    for (const opResult of response.results) {
      const planned = pending.plan.ops[opResult.index];
      // Only a definitive per-op refusal proves the product is no longer sold.
      if (opResult.status === 'failed' && opResult.reason === 'product_discontinued' && installation?.providerId
        && (planned.op.op === 'add' || planned.op.op === 'set')) {
        recordRetailerAvailability(installation.providerId, planned.retailerProductId, 'discontinued', now);
        (result.discontinued ??= []).push(planned.retailerProductId);
      }
    }
    if (installation?.providerId) markNoteExposure(installationId, desiredState(installationId, installation.providerId).notes, response.list, now);
    writePending(installationId, null);
  });
  const events: HistoryEventInput[] = [];
  const nameOf = (id: string) => installation?.providerId ? getRetailerProduct(installation.providerId, id)?.name ?? id : id;
  for (const opResult of response.results) {
    // Per-op `failed` means the plugin guarantees nothing was written for that op.
    if (opResult.status === 'applied') {
      result.applied++;
      const planned = pending.plan.ops[opResult.index];
      const op = planned.op;
      const productName = nameOf(planned.retailerProductId);
      const quantity = op.op === 'add' || op.op === 'set' ? op.quantity : 0;
      const confirmed = op.op === 'remove' ? 'removal from the shared list'
        : op.op === 'add_note' ? `the note "${op.text}" on the shared list`
          : op.op === 'remove_note' ? `removal of the note "${op.expectedText}" from the shared list`
            : `shared-list quantity ${quantity}`;
      const message = `${productName}: ${installation?.name ?? 'Retailer'} confirmed ${confirmed}.`;
      log.info(`[Shop] ${message}`);
      events.push(activityEvent({ source: 'App', target: 'App', category: 'shopping', productName,
        entityRef: `retailer:${installation?.providerId}:${planned.retailerProductId}`, message,
        reason: op.op === 'add_note' || op.op === 'remove_note'
          ? 'The retailer no longer sells this product, so the shared list carries a note instead.'
          : 'The plugin confirmed this shopping list operation.',
        details: { installationId, retailerProductId: planned.retailerProductId, operation: op.op, quantity, managedQuantity: planned.onApplied?.managedQty ?? 0 },
      }));
    }
    else if (opResult.status === 'conflict') {
      result.conflicts++;
      const planned = pending.plan.ops[opResult.index];
      const reason = opResult.message ?? opResult.reason ?? 'The retailer reported a conflict.';
      (result.operationIssues ??= []).push({ retailerProductId: planned.retailerProductId, operation: planned.op.op, outcome: 'conflict', reason });
      events.push(activityEvent({ source: 'App', target: 'App', category: 'shopping', level: 'warning',
        entityRef: `retailer:${installation?.providerId}:${planned.retailerProductId}`,
        productName: nameOf(planned.retailerProductId),
        message: `Retailer list operation ${planned.op.op} was not applied because the list changed.`,
        reason,
        details: { installationId, retailerProductId: planned.retailerProductId, operation: planned.op.op, result: opResult },
      }));
      if (planned.op.op === 'add_note' && opResult.reason === 'note_exists') {
        const productName = nameOf(planned.retailerProductId);
        const message = `The replacement note "${planned.op.text}" for ${productName} already exists and is left to the household. Remove it manually when bought; it may be from an interrupted write.`;
        log.warn(`[Shop] ${message}`);
        events.push(activityEvent({ source: 'App', target: 'App', category: 'shopping', productName,
          entityRef: `retailer:${installation?.providerId}:${planned.retailerProductId}`, message,
          reason: 'The note cannot safely be claimed or removed automatically.',
          details: { installationId, retailerProductId: planned.retailerProductId, operation: 'add_note', manualCleanup: true },
        }));
      }
    }
    else {
      result.failed++;
      const planned = pending.plan.ops[opResult.index];
      const reason = opResult.message ?? opResult.reason ?? 'The retailer refused the operation.';
      result.message = reason;
      (result.operationIssues ??= []).push({ retailerProductId: planned.retailerProductId, operation: planned.op.op, outcome: 'failed', reason });
      events.push(activityEvent({ source: 'App', target: 'App', category: 'shopping', level: 'error',
        entityRef: `retailer:${installation?.providerId}:${planned.retailerProductId}`,
        productName: nameOf(planned.retailerProductId),
        message: `Retailer list operation ${planned.op.op} failed.`, reason,
        details: { installationId, retailerProductId: planned.retailerProductId, operation: planned.op.op, result: opResult },
      }));
    }
  }
  for (const id of result.discontinued ?? []) {
    log.warn(`[Shop] ${installation?.name ?? 'Retailer'} reports retailer product ${id} as no longer sold; the shared list will carry a note instead.`);
  }
  // Audit storage must never reopen an already settled retailer operation.
  try {
    const previousIssues = getLastListSync(installationId)?.result.operationIssues;
    const issueKeys = (issues: ListSyncResult['operationIssues']) => JSON.stringify([...new Set((issues ?? []).map(issue => JSON.stringify([issue.retailerProductId, issue.operation, issue.outcome, issue.reason])))].sort());
    const repeatedIssues = issueKeys(previousIssues) === issueKeys(result.operationIssues);
    const auditEvents = events.filter(event => !repeatedIssues || (event.level !== 'warning' && event.level !== 'error'));
    if (auditEvents.length) {
      await recordHistoryRun({ trigger: 'scheduler', action: 'shop_list_sync', status: result.failed && !result.applied ? 'failure' : result.failed || result.conflicts ? 'partial' : 'success', startedAt: now, finishedAt: now, events: auditEvents });
    }
  } catch (error) { log.warn('[Shop] Could not record confirmed list changes:', error); }
  return true;
}

function formatAmount(amount: number): string {
  return String(Math.round(amount * 1000) / 1000);
}

/**
 * Text of the note that stands in for a discontinued product: our own target
 * name with the open amount in the target base unit, for example
 * "Kipfilet — 500 g". Retailers ignore quantities on notes, so the amount is
 * part of the text.
 */
export function noteTextForExport(row: Pick<ShopExportRow, 'retailerProductId' | 'baseAmount'>, providerId: string): string {
  const mapping = getRetailerMapping(providerId, row.retailerProductId);
  const unit = mapping?.packageBaseUnitName?.trim();
  const amount = `${formatAmount(row.baseAmount)}${unit ? ` ${unit}` : ''}`;
  const suffix = ` — ${amount}`;
  const name = (mapping?.targetName ?? getRetailerProduct(providerId, row.retailerProductId)?.name ?? row.retailerProductId)
    .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return `${name.slice(0, Math.max(1, 200 - suffix.length))}${suffix}`;
}

/**
 * Desired list state per active export. A product the retailer reports as
 * discontinued, or one the user chose to show as text for this account, is
 * represented by a note instead; temporarily unavailable products stay on the
 * list as themselves. Alternatives are never substituted automatically.
 */
function desiredState(installationId: string, providerId: string | null): { lines: Map<string, DesiredLine>; notes: Map<string, DesiredNote> } {
  const lines = new Map<string, DesiredLine>();
  const notes = new Map<string, DesiredNote>();
  const manual = new Set(manualNoteProductIds(installationId));
  for (const row of listActiveExports(installationId)) {
    const product = providerId ? getRetailerProduct(providerId, row.retailerProductId) : null;
    if (providerId && (product?.availability === 'discontinued' || manual.has(row.retailerProductId))) {
      if (row.packages > 0 && row.baseAmount > 0) notes.set(row.retailerProductId, { text: noteTextForExport(row, providerId), exportId: row.id });
      continue;
    }
    lines.set(row.retailerProductId, { packages: row.packages, exportId: row.id });
  }
  return { lines, notes };
}

/**
 * Remember when demand became visible as a note (ours or an identical one
 * someone else wrote), so receipts for mapped alternatives can treat it as
 * exported demand.
 */
function markNoteExposure(installationId: string, notes: Map<string, DesiredNote>, list: ShopList, now: Date): void {
  const listed = new Set(list.lines.filter(line => line.retailerProductId === null).map(line => normalizeNoteText(line.description)));
  for (const note of notes.values()) {
    if (!note.exportId || !listed.has(normalizeNoteText(note.text))) continue;
    db.update(shopExports).set({ noteExposedAt: now })
      .where(and(eq(shopExports.id, note.exportId), eq(shopExports.installationId, installationId), isNull(shopExports.noteExposedAt)))
      .run();
  }
}

export interface ListReplacementBlock {
  retailerProductId: string;
  blockingRetailerProductId: string;
  blockingProductName: string;
  blockingKind: LineKind;
  blockingReason: string | null;
}

function replacementBlocks(installationId: string, providerId: string | null, records: LineRecord[], desired: ReturnType<typeof desiredState>): ListReplacementBlock[] {
  const retiring = records.filter(record => record.pausedReason !== 'released' && record.managedQty > 0
    && !(desired.lines.get(record.retailerProductId)?.packages) && !desired.notes.has(record.retailerProductId));
  if (!retiring.length) return [];
  const ids = [...new Set([...retiring.map(record => record.retailerProductId), ...desired.lines.keys(), ...desired.notes.keys()])];
  const targets = new Map<string, Set<string>>();
  const remember = (id: string, kind: string, targetId: string) => {
    const keys = targets.get(id) ?? new Set<string>(); keys.add(`${kind}:${targetId}`); targets.set(id, keys);
  };
  // Historical exports retain the target even after the old mapping was deleted or moved.
  for (const row of db.select({ productId: shopExports.retailerProductId, kind: shopExportAllocations.targetKind, targetId: shopExportAllocations.targetId })
    .from(shopExportAllocations).innerJoin(shopExports, eq(shopExports.id, shopExportAllocations.exportId))
    .where(and(eq(shopExports.installationId, installationId), inArray(shopExports.retailerProductId, ids))).all()) remember(row.productId, row.kind, row.targetId);
  if (providerId) for (const id of ids) {
    const mapping = getRetailerMapping(providerId, id);
    if (mapping) remember(id, mapping.targetKind, mapping.targetId);
  }
  const blocks: ListReplacementBlock[] = [];
  for (const id of [...new Set([...desired.lines.keys(), ...desired.notes.keys()])]) {
    if (!(desired.lines.get(id)?.packages) && !desired.notes.has(id)) continue;
    for (const record of retiring) {
      if (record.retailerProductId === id || ![...(targets.get(id) ?? [])].some(key => targets.get(record.retailerProductId)?.has(key))) continue;
      blocks.push({ retailerProductId: id, blockingRetailerProductId: record.retailerProductId,
        blockingProductName: providerId ? getRetailerProduct(providerId, record.retailerProductId)?.name ?? record.retailerProductId : record.retailerProductId,
        blockingKind: record.kind, blockingReason: record.pausedReason });
    }
  }
  return blocks;
}

/** Readable through the overview/MCP, including when the plugin is offline. */
export function listReplacementBlocks(installationId: string): ListReplacementBlock[] {
  const providerId = getInstallation(installationId)?.providerId ?? null;
  return replacementBlocks(installationId, providerId, listLineRecords(installationId).map(toRecord), desiredState(installationId, providerId));
}

/** Retire the old representation before adding a different preferred product for the same target. */
function stageTargetReplacements(installationId: string, providerId: string | null, records: LineRecord[], desired: ReturnType<typeof desiredState>, plan: ListSyncPlan): void {
  const blockedIds = new Set(replacementBlocks(installationId, providerId, records, desired).map(block => block.retailerProductId));
  plan.ops = plan.ops.filter(planned => {
    if (planned.op.op !== 'add' && planned.op.op !== 'add_note' && planned.op.op !== 'set') return true;
    if ((planned.onApplied?.managedQty ?? 0) === 0) return true;
    return !blockedIds.has(planned.retailerProductId);
  });
}

export async function syncInstallationList(installationId: string, deps: ListSyncDeps): Promise<ListSyncResult> {
  const startedAt = deps.now();
  const previous = getLastListSync(installationId);
  const result = await syncInstallationListImpl(installationId, deps);
  if (result.status === 'skipped') return result;
  try {
    recordListSync(installationId, result, deps.now());
    if (result.status !== 'ok' && (previous?.result.status !== result.status || previous.result.message !== result.message)) {
      const installation = getInstallation(installationId);
      await recordHistoryRun({ trigger: 'scheduler', action: 'shop_list_sync',
        status: result.status === 'error' ? 'failure' : 'partial', startedAt, finishedAt: deps.now(),
        message: `${installation?.name ?? 'Retailer'} list sync: ${result.message ?? result.status}`,
        events: [activityEvent({ source: 'App', target: 'App', category: 'shopping', level: result.status === 'error' ? 'error' : 'warning',
          entityKind: 'system', entityRef: `shop-list:${installationId}`,
          message: `${installation?.name ?? 'Retailer'} shopping list could not be synchronized.`,
          reason: result.message ?? result.status, details: { installationId, ...result },
        })],
      });
    }
  } catch (error) { log.warn('[Shop] Could not record list sync outcome:', error); }
  return result;
}

async function syncInstallationListImpl(installationId: string, deps: ListSyncDeps): Promise<ListSyncResult> {
  const result: ListSyncResult = { status: 'ok', applied: 0, conflicts: 0, failed: 0, paused: 0 };
  const running = runningSyncs();
  if (running.has(installationId)) return { ...result, status: 'skipped', message: 'A list sync is already running' };
  // A fresh owner per run: the lease is not re-entrant across overlapping runs.
  const leaseName = `shop-list:${installationId}`;
  const leaseOwner = randomUUID();
  if (!acquireLease(leaseName, leaseOwner, LEASE_TTL_MS)) {
    return { ...result, status: 'skipped', message: 'Another list sync is running' };
  }
  running.add(installationId);
  try {
    const pending = readPending(installationId);
    if (pending) {
      const confirmed = await sendApply(installationId, pending, deps, result, true);
      if (!confirmed) return result;
    }

    const list = await deps.readList();
    if (!pinListId(installationId, list.listId)) {
      return { ...result, status: 'list_changed', message: 'The plugin now reports a different shopping list. Reset the list binding after reviewing it.' };
    }
    const records = listLineRecords(installationId).map(toRecord);
    const providerId = getInstallation(installationId)?.providerId ?? null;
    const desired = desiredState(installationId, providerId);
    const plan = planListSync(records, desired.lines, list, { desiredNotes: desired.notes, notesSupported: Boolean(deps.notesSupported) });
    stageTargetReplacements(installationId, providerId, records, desired, plan);
    const now = deps.now();
    db.transaction(() => {
      for (const update of plan.immediate) {
        writeRecord(installationId, update.retailerProductId, update.kind, update.record, now);
        if (update.record?.pausedReason && update.record.pausedReason !== 'released') result.paused++;
      }
      markNoteExposure(installationId, desired.notes, list, now);
    });
    if (plan.ops.length === 0) return result;
    // Renew the lease before the write so it cannot lapse during a slow read.
    if (!acquireLease(leaseName, leaseOwner, LEASE_TTL_MS)) {
      return { ...result, status: 'skipped', message: 'The list lease was lost' };
    }
    await sendApply(installationId, {
      params: { opId: randomUUID(), listId: list.listId, ops: plan.ops.map(planned => planned.op) },
      plan,
    }, deps, result);
    return result;
  } catch (error) {
    return { ...result, status: 'error', message: error instanceof Error ? error.message : String(error) };
  } finally {
    running.delete(installationId);
    releaseLease(leaseName, leaseOwner);
  }
}

/**
 * Apply the user's explanation of a paused line. Takes the same lease as the
 * list sync, so it can never interleave with a running read/modify/write.
 */
export function resolvePausedListLine(installationId: string, retailerProductId: string, resolution: PauseResolution, now = new Date(), kind: LineKind = 'product'): boolean | 'busy' {
  const leaseName = `shop-list:${installationId}`;
  const leaseOwner = randomUUID();
  if (runningSyncs().has(installationId) || !acquireLease(leaseName, leaseOwner, 10_000)) return 'busy';
  try {
    return resolvePausedListLineLocked(installationId, retailerProductId, resolution, now, kind);
  } finally {
    releaseLease(leaseName, leaseOwner);
  }
}

function resolvePausedListLineLocked(installationId: string, retailerProductId: string, resolution: PauseResolution, now: Date, kind: LineKind): boolean {
  const row = db.select().from(shopListLines)
    .where(and(eq(shopListLines.installationId, installationId), eq(shopListLines.retailerProductId, retailerProductId), eq(shopListLines.kind, kind)))
    .get();
  if (!row?.pausedReason || row.pausedReason === 'released') return false;
  const desired = desiredState(installationId, getInstallation(installationId)?.providerId ?? null);
  const currentExportId = (kind === 'note' ? desired.notes : desired.lines).get(retailerProductId)?.exportId ?? null;
  writeRecord(installationId, retailerProductId, kind, resolvePausedLine(toRecord(row), resolution, currentExportId), now);
  return true;
}

/** Forget all list ownership of an installation, for example after the user reviewed a list change. */
export function resetListOwnership(installationId: string, resetBinding?: () => void): true | 'busy' {
  const leaseName = `shop-list:${installationId}`;
  const leaseOwner = randomUUID();
  if (runningSyncs().has(installationId) || !acquireLease(leaseName, leaseOwner, 10_000)) return 'busy';
  try {
    db.transaction(() => {
      if (resetBinding) {
        resetBinding();
        // Manual note choices belong to the old account; never carry them over.
        clearManualNotePreferences(installationId);
      }
      db.delete(shopListLines).where(eq(shopListLines.installationId, installationId)).run();
      writePending(installationId, null);
    });
    return true;
  } finally {
    releaseLease(leaseName, leaseOwner);
  }
}

export function isListBindingCurrent(installationId: string, listId: string): boolean {
  const pinned = getInstallation(installationId)?.settings.pinnedListId;
  return !pinned || pinned === listId;
}

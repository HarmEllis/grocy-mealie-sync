import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { appMeta, shopListLines } from '../db/schema';
import { acquireLease, releaseLease } from '../sync/mutex';
import type { ListApplyParams, ListApplyResult, ShopList } from '../plugins/protocol/v1';
import { PluginCallError } from '../plugins/gateway';
import { getInstallation, pinListId } from '../plugins/installations';
import { listActiveExports } from './projection';
import {
  planListSync,
  recordsAfterApply,
  resolvePausedLine,
  validateApplyResults,
  type DesiredLine,
  type LineRecord,
  type ListSyncPlan,
  type PauseReason,
  type PauseResolution,
} from './list-ownership';

export interface ListSyncDeps {
  readList: () => Promise<ShopList>;
  applyList: (params: ListApplyParams) => Promise<ListApplyResult>;
  now: () => Date;
}

export interface ListSyncResult {
  status: 'ok' | 'skipped' | 'pending_unknown' | 'list_changed' | 'error';
  applied: number;
  conflicts: number;
  failed: number;
  paused: number;
  message?: string;
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

function writeRecord(installationId: string, retailerProductId: string, record: LineRecord | null, now: Date): void {
  if (!record) {
    db.delete(shopListLines)
      .where(and(eq(shopListLines.installationId, installationId), eq(shopListLines.retailerProductId, retailerProductId)))
      .run();
    return;
  }
  const values = {
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
    .values({ id: randomUUID(), installationId, retailerProductId, ...values })
    .onConflictDoUpdate({ target: [shopListLines.installationId, shopListLines.retailerProductId], set: values })
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
async function sendApply(installationId: string, pending: PendingApply, deps: ListSyncDeps, result: ListSyncResult): Promise<boolean> {
  writePending(installationId, pending);
  let response: ListApplyResult;
  try {
    response = await deps.applyList(pending.params);
  } catch (error) {
    if (error instanceof PluginCallError && error.outcome === 'not_applied') {
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
  for (const update of recordsAfterApply(pending.plan, response.results)) {
    writeRecord(installationId, update.retailerProductId, update.record, now);
  }
  for (const opResult of response.results) {
    // Per-op `failed` means the plugin guarantees nothing was written for that op.
    if (opResult.status === 'applied') result.applied++;
    else if (opResult.status === 'conflict') result.conflicts++;
    else result.failed++;
  }
  writePending(installationId, null);
  return true;
}

function desiredLines(installationId: string): Map<string, DesiredLine> {
  const desired = new Map<string, DesiredLine>();
  for (const row of listActiveExports(installationId)) desired.set(row.retailerProductId, { packages: row.packages, exportId: row.id });
  return desired;
}

export async function syncInstallationList(installationId: string, deps: ListSyncDeps): Promise<ListSyncResult> {
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
      const confirmed = await sendApply(installationId, pending, deps, result);
      if (!confirmed) return result;
    }

    const list = await deps.readList();
    if (!pinListId(installationId, list.listId)) {
      return { ...result, status: 'list_changed', message: 'The plugin now reports a different shopping list. Reset the list binding after reviewing it.' };
    }
    const records = listLineRecords(installationId).map(toRecord);
    const plan = planListSync(records, desiredLines(installationId), list);
    const now = deps.now();
    for (const update of plan.immediate) {
      writeRecord(installationId, update.retailerProductId, update.record, now);
      if (update.record?.pausedReason && update.record.pausedReason !== 'released') result.paused++;
    }
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
export function resolvePausedListLine(installationId: string, retailerProductId: string, resolution: PauseResolution, now = new Date()): boolean | 'busy' {
  const leaseName = `shop-list:${installationId}`;
  const leaseOwner = randomUUID();
  if (runningSyncs().has(installationId) || !acquireLease(leaseName, leaseOwner, 10_000)) return 'busy';
  try {
    return resolvePausedListLineLocked(installationId, retailerProductId, resolution, now);
  } finally {
    releaseLease(leaseName, leaseOwner);
  }
}

function resolvePausedListLineLocked(installationId: string, retailerProductId: string, resolution: PauseResolution, now: Date): boolean {
  const row = db.select().from(shopListLines)
    .where(and(eq(shopListLines.installationId, installationId), eq(shopListLines.retailerProductId, retailerProductId)))
    .get();
  if (!row?.pausedReason || row.pausedReason === 'released') return false;
  const currentExportId = desiredLines(installationId).get(retailerProductId)?.exportId ?? null;
  writeRecord(installationId, retailerProductId, resolvePausedLine(toRecord(row), resolution, currentExportId), now);
  return true;
}

/** Forget all list ownership of an installation, for example after the user reviewed a list change. */
export function resetListOwnership(installationId: string, resetBinding?: () => void): true | 'busy' {
  const leaseName = `shop-list:${installationId}`;
  const leaseOwner = randomUUID();
  if (runningSyncs().has(installationId) || !acquireLease(leaseName, leaseOwner, 10_000)) return 'busy';
  try {
    db.transaction(() => {
      resetBinding?.();
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

import { eq } from 'drizzle-orm';
import { db } from '../db';
import { appMeta, syncState } from '../db/schema';
import { listInstallations } from '../plugins/installations';
import { getPluginGateway } from '../plugins/runtime';
import { getReceiptCursor, RECEIPT_PULL_INTERVAL_MS } from './receipts';
import { log } from '../logger';
import { parseStoredJson } from './stored-json';
import type { ListSyncResult } from './list-sync';

const JOB_STATE_ID = 'shop:last-reconcile';

export interface ShopDashboardStatus {
  lastJob: { finishedAt: string; status: string } | null;
  nextProcessingAt: string | null;
  receipts: Array<{
    installationId: string;
    name: string;
    state: 'disabled' | 'disconnected' | 'unsupported' | 'signed_out' | 'ready';
    lastCheckedAt: string | null;
    nextCheckAt: string | null;
    lastError: string | null;
    listSync: { finishedAt: string; result: ListSyncResult } | null;
  }>;
}

/** Retain list failures even when they happen before any retailer write. */
export function recordListSync(installationId: string, result: ListSyncResult, finishedAt = new Date()): void {
  const key = `shop-list-status:${installationId}`;
  const value = JSON.stringify({ finishedAt: finishedAt.toISOString(), result });
  db.insert(appMeta).values({ key, value }).onConflictDoUpdate({ target: appMeta.key, set: { value } }).run();
}

export function getLastListSync(installationId: string): { finishedAt: string; result: ListSyncResult } | null {
  const row = db.select().from(appMeta).where(eq(appMeta.key, `shop-list-status:${installationId}`)).get();
  return parseStoredJson<{ finishedAt: string; result: ListSyncResult } | null>(row?.value, null);
}

/** Separate from the core sync snapshot so plugin I/O cannot overwrite it. */
export function recordShopJob(status: string, finishedAt = new Date()): void {
  const stateData = JSON.stringify({ status, finishedAt: finishedAt.toISOString() });
  db.insert(syncState).values({ id: JOB_STATE_ID, stateData })
    .onConflictDoUpdate({ target: syncState.id, set: { stateData } }).run();
}

export function getShopDashboardStatus(schedulerActive: boolean, now = new Date(), nextPollRun: Date | null = null): ShopDashboardStatus {
  const saved = db.select().from(syncState).where(eq(syncState.id, JOB_STATE_ID)).get();
  const gateway = getPluginGateway();
  const installations = listInstallations();
  return {
    lastJob: parseStoredJson<ShopDashboardStatus['lastJob']>(saved?.stateData, null),
    nextProcessingAt: schedulerActive && installations.length && nextPollRun
      ? nextPollRun.toISOString() : null,
    receipts: installations.map(installation => {
      const session = gateway?.getSession(installation.id);
      const cursor = installation.accountKey ? getReceiptCursor(installation.id, installation.accountKey) : null;
      const listSync = getLastListSync(installation.id);
      const state = !installation.settings.receiptsEnabled ? 'disabled'
        : !session || !schedulerActive ? 'disconnected'
        : !session.hello.capabilities.includes('receipts') ? 'unsupported'
        : !installation.accountKey || installation.authState !== 'authenticated' ? 'signed_out' : 'ready';
      return {
        installationId: installation.id,
        name: installation.name,
        state,
        lastCheckedAt: cursor?.lastPullAt?.toISOString() ?? null,
        nextCheckAt: state === 'ready'
          ? new Date(cursor?.pageCursor || !cursor?.lastPullAt ? now.getTime()
            : cursor.lastPullAt.getTime() + RECEIPT_PULL_INTERVAL_MS).toISOString() : null,
        lastError: cursor?.lastError ?? null,
        listSync,
      };
    }),
  };
}

/** Shopping diagnostics must not make the core dashboard unavailable. */
export function getSafeShopDashboardStatus(schedulerActive: boolean, nextPollRun: Date | null): ShopDashboardStatus | null {
  try { return getShopDashboardStatus(schedulerActive, new Date(), nextPollRun); }
  catch (error) { log.warn('[Shop] Could not load dashboard status:', error); return null; }
}

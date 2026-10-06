import { config } from '../config';
import type { HistoryEventInput } from '../history-store';
import { log } from '../logger';
import { getPluginGateway, setShopWorker, type ShopWorkerHandle } from '../plugins/runtime';
import { getInstallation, hasActiveInstallations, listInstallations, type PluginInstallation } from '../plugins/installations';
import { resolveShoppingListId } from '../settings';
import { fetchAllMealieShoppingItems } from '../sync/helpers';
import { activityEvent } from '../sync/activity';
import type { SchedulerStepStatus } from '../scheduler-notifications';
import { loadUnitContext } from './context';
import { listOpenDemand, observeDemand } from './demand-observer';
import { defaultEffectRunnerDeps } from './effect-runners';
import { syncInstallationList } from './list-sync';
import { persistExports, projectDemand, targetKey, type ProjectionMapping } from './projection';
import { isReceiptPullDue, pullReceipts } from './receipts';
import { runShopReconcile } from './reconcile-executor';
import { generateSuggestions, listRetailerMappings } from './retailer-catalog';
import type { TargetKind } from './units';

/**
 * Orchestration of the shop features. Everything here is owned by the
 * scheduler: the poll cycle runs the core steps under the sync lock, and the
 * plugin I/O timer is started and stopped together with the scheduler. The
 * gateway only accepts plugin sessions while this instance owns the
 * scheduler, so connected plugins always have a running worker.
 */

export interface ShopStepOutcome {
  status: SchedulerStepStatus;
  message?: string;
  summary?: unknown;
  events?: HistoryEventInput[];
}

/** Shop steps run only when at least one plugin installation exists; otherwise nothing changes. */
export function isShopFeatureActive(): boolean {
  try {
    return hasActiveInstallations();
  } catch (error) {
    log.warn('[Shop] Could not check plugin installations:', error);
    return false;
  }
}

/** Observe demand and project it onto each list-sync installation. Runs under the sync lock. */
export async function runShopDemandStep(): Promise<ShopStepOutcome> {
  const shoppingListId = await resolveShoppingListId();
  if (!shoppingListId) return { status: 'skipped', message: 'No Mealie shopping list configured' };
  const items = await fetchAllMealieShoppingItems(shoppingListId);
  const observation = observeDemand(shoppingListId, items);

  const projecting = listInstallations().filter(installation => installation.providerId && installation.settings.listSyncEnabled);
  const summary: Record<string, unknown> = { observation, projections: [] as unknown[] };
  if (projecting.length === 0) return { status: 'success', summary };

  const ctx = await loadUnitContext();
  const open = listOpenDemand(shoppingListId);
  const demands = open.map(({ revision }) => {
    let subItems = null;
    try {
      subItems = revision.subItemsJson ? JSON.parse(revision.subItemsJson) : null;
    } catch {
      subItems = null;
    }
    return {
      revisionId: revision.id,
      mealieItemId: revision.mealieItemId,
      foodId: revision.foodId,
      unitId: revision.unitId,
      quantity: revision.quantity,
      subItems,
      label: (revision.foodId && ctx.mealieFoodNames.get(revision.foodId)) || revision.note || revision.mealieItemId,
    };
  });
  const events: HistoryEventInput[] = [];
  for (const installation of projecting) {
    const providerId = installation.providerId!;
    const preferred = new Map<string, ProjectionMapping>();
    for (const mapping of listRetailerMappings(providerId)) {
      if (mapping.role !== 'preferred') continue;
      preferred.set(targetKey(mapping.targetKind as TargetKind, mapping.targetId), {
        retailerProductId: mapping.retailerProductId,
        targetKind: mapping.targetKind as TargetKind,
        targetId: mapping.targetId,
        packageBaseAmount: mapping.packageBaseAmount,
        packageBaseUnitId: mapping.packageBaseUnitId,
        confirmed: mapping.confirmed,
      });
    }
    const projection = projectDemand(demands, preferred, ctx);
    const persisted = persistExports(installation.id, providerId, projection.lines, new Date());
    (summary.projections as unknown[]).push({
      installationId: installation.id,
      lines: projection.lines.length,
      review: projection.review.length,
      ...persisted,
    });
    const candidates = [
      ...[...ctx.grocyProducts.values()].map(product => ({ targetKind: 'grocy_product' as const, targetId: String(product.id), targetName: product.name })),
    ];
    generateSuggestions(providerId, candidates);
    if (persisted.written > 0) {
      events.push(activityEvent({
        source: 'Mealie', target: 'App', category: 'shopping', entityKind: 'system',
        entityRef: `plugin:${installation.id}`, message: `Updated ${persisted.written} product(s) for the ${installation.name} shopping list.`,
        reason: 'Open Mealie demand changed.', details: { installationId: installation.id, ...persisted },
      }));
    }
  }
  return { status: 'success', summary, events };
}

/** Verify, plan and execute receipt effects. Runs under the sync lock. */
export async function runShopReconcileStep(): Promise<ShopStepOutcome> {
  const shoppingListId = await resolveShoppingListId();
  const result = await runShopReconcile({
    runner: defaultEffectRunnerDeps,
    shoppingListId,
    loadMealieItems: fetchAllMealieShoppingItems,
    loadUnitContext,
    observationGraceMs: config.pollIntervalSeconds * 1000 + 60_000,
    now: () => new Date(),
  });
  return {
    status: result.status === 'ok' ? 'success' : result.status === 'error' ? 'failure' : result.status,
    message: result.message,
    summary: result.summary,
    events: result.events,
  };
}

// ---------------------------------------------------------------------------
// Plugin I/O timer
// ---------------------------------------------------------------------------

const WORKER_INTERVAL_MS = 60_000;

/**
 * Two installations signed in to the same retailer account would fight over
 * one shared list. Only the oldest one runs list sync; receipts are
 * deduplicated per account anyway.
 */
function listSyncOwner(installations: PluginInstallation[], candidate: PluginInstallation): boolean {
  if (!candidate.accountKey || !candidate.providerId) return false;
  const sameAccount = installations
    .filter(other => other.providerId === candidate.providerId && other.accountKey === candidate.accountKey)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return sameAccount[0]?.id === candidate.id;
}

export function createShopWorker(): ShopWorkerHandle & { start: () => void; stop: () => void; onSessionReady: (installationId: string) => void } {
  let timer: ReturnType<typeof setInterval> | null = null;
  let running: Promise<void> | null = null;
  const listRequests = new Set<string>();
  const receiptRequests = new Set<string>();
  let rerun = false;

  async function tick(): Promise<void> {
    const gateway = getPluginGateway();
    const sessions = gateway?.listSessions() ?? [];
    // Without connected plugins the worker does nothing, not even a database read.
    if (!gateway || sessions.length === 0) return;
    const installations = listInstallations();
    for (const session of sessions) {
      const installation = installations.find(candidate => candidate.id === session.installationId);
      if (!installation || installation.revokedAt) continue;
      const capabilities = new Set<string>(session.hello.capabilities);
      const now = new Date();

      if (installation.settings.listSyncEnabled && capabilities.has('list') && listSyncOwner(installations, installation)) {
        listRequests.delete(installation.id);
        const result = await syncInstallationList(installation.id, {
          readList: () => gateway.call(installation.id, 'list.read', {}),
          applyList: params => gateway.call(installation.id, 'list.apply', params),
          now: () => new Date(),
        });
        if (result.status !== 'ok' && result.status !== 'skipped') {
          log.warn(`[Shop] List sync for ${installation.name}: ${result.status}${result.message ? ` (${result.message})` : ''}`);
        }
      }

      if (installation.settings.receiptsEnabled && capabilities.has('receipts')
        && (receiptRequests.has(installation.id) || isReceiptPullDue(installation, now))) {
        receiptRequests.delete(installation.id);
        const fresh = getInstallation(installation.id) ?? installation;
        const result = await pullReceipts(fresh, {
          listReceipts: params => gateway.call(installation.id, 'receipts.list', params),
          getReceipt: receiptId => gateway.call(installation.id, 'receipts.get', { receiptId }),
          now: () => new Date(),
        });
        if (result.status === 'error') log.warn(`[Shop] Receipt pull for ${installation.name} failed: ${result.message}`);
        else if (result.stored > 0) log.info(`[Shop] Stored ${result.stored} new receipt(s) from ${installation.name}`);
      }
    }
  }

  function run(): Promise<void> {
    if (running) {
      rerun = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          rerun = false;
          await tick();
        } while (rerun);
      } catch (error) {
        log.warn('[Shop] Worker tick failed:', error);
      } finally {
        running = null;
      }
    })();
    return running;
  }

  return {
    start: () => {
      if (timer) return;
      timer = setInterval(() => void run(), WORKER_INTERVAL_MS);
      timer.unref?.();
      void run();
    },
    stop: () => {
      if (timer) clearInterval(timer);
      timer = null;
    },
    requestListSync: (installationId) => {
      if (installationId) listRequests.add(installationId);
      void run();
    },
    requestReceiptPull: (installationId) => {
      if (installationId) receiptRequests.add(installationId);
      void run();
    },
    onSessionReady: (installationId) => {
      // Catch-up never depends on hints: pull and sync whenever a session starts.
      receiptRequests.add(installationId);
      listRequests.add(installationId);
      void run();
    },
    runNow: () => run(),
  };
}

let worker: ReturnType<typeof createShopWorker> | null = null;

/** Started and stopped by the scheduler that owns this instance. */
export function startShopWorker(): void {
  worker ??= createShopWorker();
  setShopWorker(worker);
  worker.start();
}

export function stopShopWorker(): void {
  worker?.stop();
  setShopWorker(undefined);
}

export function getLocalShopWorker() {
  return worker;
}

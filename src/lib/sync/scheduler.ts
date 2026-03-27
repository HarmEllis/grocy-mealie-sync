import { config } from '../config';
import { log } from '../logger';
import { buildConflictCheckHistoryOutcome, buildGrocyToMealieHistoryOutcome, buildMealieToGrocyHistoryOutcome, buildProductSyncHistoryOutcome, prefixHistoryEvents } from '../history-events';
import { recordHistoryRun, type HistoryEventInput } from '../history-store';
import {
  sendSchedulerNotifications,
  summarizeSchedulerCycle,
  type SchedulerCycleType,
  type SchedulerStepName,
  type SchedulerStepResult,
  type SchedulerStepStatus,
} from '../scheduler-notifications';
import { runMappingConflictCheck } from '../mapping-conflicts-store';
import { runFullProductSync } from './product-sync';
import { pollGrocyForMissingStock } from './grocy-to-mealie';
import { pollMealieForCheckedItems } from './mealie-to-grocy';
import {
  acquireSchedulerLock,
  acquireSyncLock,
  releaseSchedulerLock,
  releaseSyncLock,
} from './mutex';

let pollTimer: ReturnType<typeof setInterval> | null = null;
let productSyncTimer: ReturnType<typeof setInterval> | null = null;
let started = false;
let schedulerLockHeld = false;

interface SchedulerStepExecutionResult {
  status?: SchedulerStepStatus;
  message?: string;
  summary?: unknown;
  events?: HistoryEventInput[];
}

interface SchedulerStepDefinition {
  name: SchedulerStepName;
  failureLogPrefix: string;
  run: () => Promise<SchedulerStepExecutionResult | void>;
}

function formatSchedulerError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
}

function getSchedulerStepEventLevel(status: SchedulerStepStatus): 'info' | 'warning' | 'error' {
  switch (status) {
    case 'failure':
      return 'error';
    case 'partial':
    case 'skipped':
      return 'warning';
    case 'success':
      return 'info';
  }
}

function getSchedulerStepCategory(name: SchedulerStepName): HistoryEventInput['category'] {
  return name === 'conflict_check' ? 'conflict' : 'sync';
}

function getSchedulerStepLabel(name: SchedulerStepName): string {
  switch (name) {
    case 'product_sync':
      return 'Product sync';
    case 'mealie_to_grocy':
      return 'Mealie to Grocy';
    case 'grocy_to_mealie':
      return 'Grocy to Mealie';
    case 'conflict_check':
      return 'Conflict check';
  }
}

async function runSchedulerCycle(
  cycleType: SchedulerCycleType,
  steps: SchedulerStepDefinition[],
): Promise<void> {
  const startedAt = new Date();
  const stepResults: SchedulerStepResult[] = [];
  const historyEvents: HistoryEventInput[] = [];

  for (const step of steps) {
    try {
      const result = await step.run();
      const status = result?.status ?? 'success';
      stepResults.push({
        name: step.name,
        status,
        message: result?.message,
        summary: result?.summary,
      });
      historyEvents.push({
        level: getSchedulerStepEventLevel(status),
        category: getSchedulerStepCategory(step.name),
        entityKind: status === 'failure' ? 'system' : null,
        entityRef: step.name,
        message: `${getSchedulerStepLabel(step.name)} step ${status}.`,
        details: result?.summary ?? null,
      });
      if (result?.events?.length) {
        historyEvents.push(...prefixHistoryEvents(getSchedulerStepLabel(step.name), result.events));
      }
    } catch (error) {
      const formattedError = formatSchedulerError(error);
      log.error(step.failureLogPrefix, error);
      stepResults.push({
        name: step.name,
        status: 'failure',
        error: formattedError,
      });
      historyEvents.push({
        level: 'error',
        category: getSchedulerStepCategory(step.name),
        entityKind: 'system',
        entityRef: step.name,
        message: `${getSchedulerStepLabel(step.name)} step failed.`,
        details: { error: formattedError },
      });
    }
  }

  const finishedAt = new Date();
  const cycleSummary = summarizeSchedulerCycle({
    cycleType,
    startedAt,
    finishedAt,
    steps: stepResults,
  });

  await sendSchedulerNotifications(cycleSummary);

  try {
    await recordHistoryRun({
      trigger: 'scheduler',
      action: 'scheduler_cycle',
      status: cycleSummary.status,
      message: `Scheduler ${cycleType} cycle ${cycleSummary.status}.`,
      startedAt,
      finishedAt,
      summary: {
        cycleType,
        durationMs: cycleSummary.durationMs,
        steps: stepResults,
      },
      events: historyEvents,
    });
  } catch (error) {
    log.warn('[Scheduler] Failed to record history:', error);
  }
}

export function startScheduler(): void {
  if (started) return;
  started = true;

  if (!acquireSchedulerLock()) {
    log.info(
      '[Scheduler] Startup lock already held; remaining passive. If this is stale, clear it via the "Clear Sync Locks" UI action or POST /api/sync/unlock, then restart the app.',
    );
    return;
  }

  schedulerLockHeld = true;

  log.info('[Scheduler] Starting sync scheduler');
  log.info(`[Scheduler] Poll interval: ${config.pollIntervalSeconds}s`);
  log.info(`[Scheduler] Product sync interval: ${config.productSyncIntervalHours}h`);

  // Run initial product sync, then start poll timers.
  // No lock needed — timers haven't started yet, so there's no race.
  (async () => {
    await runSchedulerCycle('initial', [
      {
        name: 'product_sync',
        failureLogPrefix: '[Scheduler] Initial product sync failed:',
        run: async () => {
          const result = await runFullProductSync();
          return buildProductSyncHistoryOutcome(result);
        },
      },
      {
        name: 'conflict_check',
        failureLogPrefix: '[Scheduler] Initial conflict check failed:',
        run: async () => {
          const result = await runMappingConflictCheck();
          return buildConflictCheckHistoryOutcome(result);
        },
      },
    ]);

    if (!started || !schedulerLockHeld) {
      return;
    }

    startTimers();
  })();
}

function startTimers(): void {
  // Start polling loop for Mealie→Grocy and Grocy→Mealie
  // Mealie→Grocy runs first so sync-restocked products are recorded before
  // Grocy→Mealie processes the "no longer missing" list (feedback loop guard).
  const pollMs = config.pollIntervalSeconds * 1000;
  pollTimer = setInterval(async () => {
    if (!acquireSyncLock()) {
      log.warn('[Scheduler] Skipping poll — previous sync still running');
      return;
    }

    try {
      await runSchedulerCycle('poll', [
        {
          name: 'mealie_to_grocy',
          failureLogPrefix: '[Scheduler] Mealie poll error:',
          run: async () => {
            const result = await pollMealieForCheckedItems();
            return buildMealieToGrocyHistoryOutcome(result);
          },
        },
        {
          name: 'grocy_to_mealie',
          failureLogPrefix: '[Scheduler] Grocy poll error:',
          run: async () => {
            const result = await pollGrocyForMissingStock();
            return buildGrocyToMealieHistoryOutcome('grocy_to_mealie', result);
          },
        },
        {
          name: 'conflict_check',
          failureLogPrefix: '[Scheduler] Conflict check error:',
          run: async () => {
            const result = await runMappingConflictCheck();
            return buildConflictCheckHistoryOutcome(result);
          },
        },
      ]);
    } finally {
      releaseSyncLock();
    }
  }, pollMs);

  // Periodic product re-sync (B1.5)
  const productSyncMs = config.productSyncIntervalHours * 60 * 60 * 1000;
  productSyncTimer = setInterval(async () => {
    if (!acquireSyncLock()) {
      log.warn('[Scheduler] Skipping product sync — previous sync still running');
      return;
    }

    try {
      log.info('[Scheduler] Running periodic product sync');
      await runSchedulerCycle('product_sync', [
        {
          name: 'product_sync',
          failureLogPrefix: '[Scheduler] Product sync error:',
          run: async () => {
            const result = await runFullProductSync();
            return buildProductSyncHistoryOutcome(result);
          },
        },
        {
          name: 'conflict_check',
          failureLogPrefix: '[Scheduler] Conflict check error:',
          run: async () => {
            const result = await runMappingConflictCheck();
            return buildConflictCheckHistoryOutcome(result);
          },
        },
      ]);
    } finally {
      releaseSyncLock();
    }
  }, productSyncMs);

  log.info('[Scheduler] Poll timers started');
}

export function stopScheduler(): void {
  started = false;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (productSyncTimer) {
    clearInterval(productSyncTimer);
    productSyncTimer = null;
  }
  if (schedulerLockHeld) {
    releaseSchedulerLock();
    schedulerLockHeld = false;
  }
  log.info('[Scheduler] Stopped');
}

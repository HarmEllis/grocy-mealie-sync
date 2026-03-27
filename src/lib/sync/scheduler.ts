import { config } from '../config';
import { log } from '../logger';
import {
  sendSchedulerNotifications,
  summarizeSchedulerCycle,
  type SchedulerCycleType,
  type SchedulerStepName,
  type SchedulerStepResult,
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

interface SchedulerStepDefinition {
  name: SchedulerStepName;
  failureLogPrefix: string;
  run: () => Promise<void>;
}

function formatSchedulerError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
}

async function runSchedulerCycle(
  cycleType: SchedulerCycleType,
  steps: SchedulerStepDefinition[],
): Promise<void> {
  const startedAt = new Date();
  const stepResults: SchedulerStepResult[] = [];

  for (const step of steps) {
    try {
      await step.run();
      stepResults.push({
        name: step.name,
        status: 'success',
      });
    } catch (error) {
      log.error(step.failureLogPrefix, error);
      stepResults.push({
        name: step.name,
        status: 'failure',
        error: formatSchedulerError(error),
      });
    }
  }

  await sendSchedulerNotifications(summarizeSchedulerCycle({
    cycleType,
    startedAt,
    finishedAt: new Date(),
    steps: stepResults,
  }));
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
        run: () => runFullProductSync(),
      },
      {
        name: 'conflict_check',
        failureLogPrefix: '[Scheduler] Initial conflict check failed:',
        run: async () => {
          await runMappingConflictCheck();
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
            await pollMealieForCheckedItems();
          },
        },
        {
          name: 'grocy_to_mealie',
          failureLogPrefix: '[Scheduler] Grocy poll error:',
          run: async () => {
            await pollGrocyForMissingStock();
          },
        },
        {
          name: 'conflict_check',
          failureLogPrefix: '[Scheduler] Conflict check error:',
          run: async () => {
            await runMappingConflictCheck();
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
          run: () => runFullProductSync(),
        },
        {
          name: 'conflict_check',
          failureLogPrefix: '[Scheduler] Conflict check error:',
          run: async () => {
            await runMappingConflictCheck();
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

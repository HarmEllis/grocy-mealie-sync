import { config } from '../config';
import { log } from '../logger';
import { runFullProductSync } from './product-sync';
import { pollGrocyForMissingStock } from './grocy-to-mealie';
import { pollMealieForCheckedItems } from './mealie-to-grocy';
import { acquireSyncLock, releaseSyncLock } from './mutex';

let pollTimer: ReturnType<typeof setInterval> | null = null;
let productSyncTimer: ReturnType<typeof setInterval> | null = null;

export function startScheduler(): void {
  if (pollTimer) return;

  log.info('[Scheduler] Starting sync scheduler');
  log.info(`[Scheduler] Poll interval: ${config.pollIntervalSeconds}s`);
  log.info(`[Scheduler] Product sync interval: ${config.productSyncIntervalHours}h`);

  // Run initial product sync on startup
  runFullProductSync().catch(err => {
    log.error('[Scheduler] Initial product sync failed:', err);
  });

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
      await pollMealieForCheckedItems();
    } catch (err) {
      log.error('[Scheduler] Mealie poll error:', err);
    }
    try {
      await pollGrocyForMissingStock();
    } catch (err) {
      log.error('[Scheduler] Grocy poll error:', err);
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
      await runFullProductSync();
    } catch (err) {
      log.error('[Scheduler] Product sync error:', err);
    } finally {
      releaseSyncLock();
    }
  }, productSyncMs);
}

export function stopScheduler(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (productSyncTimer) {
    clearInterval(productSyncTimer);
    productSyncTimer = null;
  }
  log.info('[Scheduler] Stopped');
}

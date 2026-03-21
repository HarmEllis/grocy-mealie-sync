import { config } from '../config';
import { log } from '../logger';
import { runFullProductSync } from './product-sync';
import { pollGrocyForMissingStock } from './grocy-to-mealie';
import { pollMealieForCheckedItems } from './mealie-to-grocy';

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

  // Start polling loop for Grocy→Mealie and Mealie→Grocy
  const pollMs = config.pollIntervalSeconds * 1000;
  pollTimer = setInterval(async () => {
    try {
      await pollGrocyForMissingStock();
    } catch (err) {
      log.error('[Scheduler] Grocy poll error:', err);
    }
    try {
      await pollMealieForCheckedItems();
    } catch (err) {
      log.error('[Scheduler] Mealie poll error:', err);
    }
  }, pollMs);

  // Periodic product re-sync (B1.5)
  const productSyncMs = config.productSyncIntervalHours * 60 * 60 * 1000;
  productSyncTimer = setInterval(async () => {
    try {
      log.info('[Scheduler] Running periodic product sync');
      await runFullProductSync();
    } catch (err) {
      log.error('[Scheduler] Product sync error:', err);
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

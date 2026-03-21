import { config } from '../config';
import { runFullProductSync } from './product-sync';
import { pollGrocyForMissingStock } from './grocy-to-mealie';
import { pollMealieForCheckedItems } from './mealie-to-grocy';
import { getSyncState, saveSyncState } from './state';

let pollTimer: ReturnType<typeof setInterval> | null = null;
let productSyncTimer: ReturnType<typeof setInterval> | null = null;

export async function startScheduler(): Promise<void> {
  if (pollTimer) return;

  const state = await getSyncState();
  state.schedulerRunning = true;
  state.schedulerStartedAt = new Date();
  await saveSyncState(state);

  console.log('[Scheduler] Starting sync scheduler');
  console.log(`[Scheduler] Poll interval: ${config.pollIntervalSeconds}s`);
  console.log(`[Scheduler] Product sync interval: ${config.productSyncIntervalHours}h`);

  // Run initial product sync on startup
  runFullProductSync().catch(err => {
    console.error('[Scheduler] Initial product sync failed:', err);
  });

  // Start polling loop for Grocy→Mealie and Mealie→Grocy
  const pollMs = config.pollIntervalSeconds * 1000;
  pollTimer = setInterval(async () => {
    try {
      await pollGrocyForMissingStock();
    } catch (err) {
      console.error('[Scheduler] Grocy poll error:', err);
    }
    try {
      await pollMealieForCheckedItems();
    } catch (err) {
      console.error('[Scheduler] Mealie poll error:', err);
    }
  }, pollMs);

  // Periodic product re-sync (B1.5)
  const productSyncMs = config.productSyncIntervalHours * 60 * 60 * 1000;
  productSyncTimer = setInterval(async () => {
    try {
      console.log('[Scheduler] Running periodic product sync');
      await runFullProductSync();
    } catch (err) {
      console.error('[Scheduler] Product sync error:', err);
    }
  }, productSyncMs);
}

export async function stopScheduler(): Promise<void> {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (productSyncTimer) {
    clearInterval(productSyncTimer);
    productSyncTimer = null;
  }

  const state = await getSyncState();
  state.schedulerRunning = false;
  await saveSyncState(state);
  console.log('[Scheduler] Stopped');
}

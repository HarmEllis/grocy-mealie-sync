import type { CleanupCheckedItemsMode } from '../config';
import { log } from '../logger';
import type { MealieShoppingItem } from '../mealie/types';
import { resolveCleanupCheckedItemsAfterHours, resolveCleanupCheckedItemsMode, resolveShoppingListId } from '../settings';
import { fetchAllMealieShoppingItems } from './helpers';
import { getSyncState, saveSyncState, type SyncStateData } from './state';
import { HouseholdsShoppingListItemsService } from '../mealie/client';

export interface ShoppingCleanupSummary {
  eligibleItems: number;
  removedItems: number;
  skippedItems: number;
  failedItems: number;
}

export interface ShoppingCleanupResult {
  status: 'ok' | 'partial' | 'skipped' | 'error';
  reason?: 'disabled' | 'no-shopping-list' | 'already-ran-today';
  summary: ShoppingCleanupSummary;
}

export interface ShoppingCleanupDeps {
  resolveAfterHours: () => Promise<number>;
  resolveMode: () => Promise<CleanupCheckedItemsMode>;
  resolveShoppingListId: () => Promise<string | null>;
  fetchShoppingItems: (shoppingListId: string) => Promise<MealieShoppingItem[]>;
  deleteShoppingItem: (itemId: string) => Promise<unknown>;
  getSyncState: () => Promise<SyncStateData>;
  saveSyncState: (state: SyncStateData) => Promise<void>;
  now: () => Date;
}

const defaultDeps: ShoppingCleanupDeps = {
  resolveAfterHours: resolveCleanupCheckedItemsAfterHours,
  resolveMode: resolveCleanupCheckedItemsMode,
  resolveShoppingListId,
  fetchShoppingItems: fetchAllMealieShoppingItems,
  deleteShoppingItem: itemId => HouseholdsShoppingListItemsService.deleteOneApiHouseholdsShoppingItemsItemIdDelete(itemId),
  getSyncState,
  saveSyncState,
  now: () => new Date(),
};

function createEmptySummary(): ShoppingCleanupSummary {
  return { eligibleItems: 0, removedItems: 0, skippedItems: 0, failedItems: 0 };
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export interface ShoppingCleanupOptions {
  skipDailyCheck?: boolean;
}

export async function runShoppingCleanup(
  deps: ShoppingCleanupDeps = defaultDeps,
  options: ShoppingCleanupOptions = {},
): Promise<ShoppingCleanupResult> {
  const summary = createEmptySummary();

  const afterHours = await deps.resolveAfterHours();
  if (afterHours < 1) {
    log.info('[Cleanup] Shopping list cleanup is disabled (afterHours = -1)');
    return { status: 'skipped', reason: 'disabled', summary };
  }

  const now = deps.now();
  const state = await deps.getSyncState();

  if (!options.skipDailyCheck && state.lastCleanupRun && isSameDay(new Date(state.lastCleanupRun), now)) {
    log.info('[Cleanup] Already ran today — skipping');
    return { status: 'skipped', reason: 'already-ran-today', summary };
  }

  const shoppingListId = await deps.resolveShoppingListId();
  if (!shoppingListId) {
    log.warn('[Cleanup] No shopping list configured — skipping');
    return { status: 'skipped', reason: 'no-shopping-list', summary };
  }

  const mode = await deps.resolveMode();
  const thresholdMs = afterHours * 60 * 60 * 1000;

  try {
    const items = await deps.fetchShoppingItems(shoppingListId);
    const currentItemIds = new Set(items.map(item => item.id));

    // Prune stale entries from mealieCheckedAt for items no longer on the list
    for (const itemId of Object.keys(state.mealieCheckedAt)) {
      if (!currentItemIds.has(itemId)) {
        delete state.mealieCheckedAt[itemId];
        delete state.mealieItemsSyncedToGrocy[itemId];
      }
    }

    // Find checked items that have been checked longer than the threshold
    for (const item of items) {
      const checkedAtIso = state.mealieCheckedAt[item.id];
      if (!checkedAtIso) {
        continue;
      }

      const checkedAt = new Date(checkedAtIso);
      const checkedDurationMs = now.getTime() - checkedAt.getTime();
      if (checkedDurationMs < thresholdMs) {
        continue;
      }

      summary.eligibleItems++;

      // In synced_only mode, skip items that were never synced to Grocy
      if (mode === 'synced_only' && !state.mealieItemsSyncedToGrocy[item.id]) {
        summary.skippedItems++;
        continue;
      }

      try {
        await deps.deleteShoppingItem(item.id);
        summary.removedItems++;
        log.info(`[Cleanup] Removed checked item "${item.note || item.display || item.id}" (checked ${afterHours}+ hours ago)`);

        // Clean up state maps
        delete state.mealieCheckedItems[item.id];
        delete state.mealieCheckedAt[item.id];
        delete state.mealieItemsSyncedToGrocy[item.id];
      } catch (err) {
        summary.failedItems++;
        log.error(`[Cleanup] Failed to remove item "${item.id}":`, err);
      }
    }

    state.lastCleanupRun = now.toISOString();
    await deps.saveSyncState(state);

    const status = summary.failedItems > 0
      ? (summary.removedItems > 0 ? 'partial' : 'error')
      : 'ok';

    return { status, summary };
  } catch (error) {
    log.error('[Cleanup] Error running shopping cleanup:', error);
    return { status: 'error', summary };
  }
}

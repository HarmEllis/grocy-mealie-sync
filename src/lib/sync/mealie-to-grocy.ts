import { db } from '../db';
import { productMappings } from '../db/schema';
import { getGrocyEntities, deleteGrocyEntity, getProductDetails, addProductStock } from '../grocy/types';
import type { ShoppingListItemOut_Output } from '../mealie/client/models/ShoppingListItemOut_Output';
import { log } from '../logger';
import { resolveShoppingListId, resolveStockOnlyMinStock } from '../settings';
import { getSyncState, saveSyncState } from './state';
import { fetchAllMealieShoppingItems } from './helpers';
import { eq } from 'drizzle-orm';

export interface MealieToGrocySyncSummary {
  checkedItems: number;
  restockedProducts: number;
  failedItems: number;
}

export interface MealieToGrocyPollResult {
  status: 'ok' | 'partial' | 'skipped' | 'error';
  reason?: 'no-shopping-list';
  summary: MealieToGrocySyncSummary;
}

function createEmptySummary(): MealieToGrocySyncSummary {
  return {
    checkedItems: 0,
    restockedProducts: 0,
    failedItems: 0,
  };
}

export async function pollMealieForCheckedItems(): Promise<MealieToGrocyPollResult> {
  log.info('[Mealie→Grocy] Polling for checked items...');

  const summary = createEmptySummary();
  const shoppingListId = await resolveShoppingListId();
  if (!shoppingListId) {
    log.warn('[Mealie→Grocy] No shopping list configured — skipping poll');
    return {
      status: 'skipped',
      reason: 'no-shopping-list',
      summary,
    };
  }

  try {
    // Fetch all items on the configured shopping list (paginated)
    const items = await fetchAllMealieShoppingItems(shoppingListId);
    const state = await getSyncState();
    const previousCheckedState = state.mealieCheckedItems;
    const newCheckedState: Record<string, boolean> = {};
    const isBootstrapPoll = state.lastMealiePoll === null;

    if (isBootstrapPoll) {
      log.info('[Mealie→Grocy] Initial poll detected — snapshotting current checked state without restocking');
    }

    for (const item of items) {
      const checked = item.checked ?? false;
      newCheckedState[item.id] = checked;
      if (checked) {
        summary.checkedItems++;
      }

      if (isBootstrapPoll) {
        continue;
      }

      // Detect newly checked items (B3.1):
      // Was unchecked (or unknown) before, now checked
      const wasChecked = previousCheckedState[item.id];
      if (checked && wasChecked !== true) {
        try {
          const grocyProductId = await processCheckedItem(item);
          if (grocyProductId !== null) {
            // Track that this product was restocked by sync, so Grocy→Mealie
            // won't remove it from the shopping list on the next poll
            state.syncRestockedProducts[String(grocyProductId)] = new Date().toISOString();
            summary.restockedProducts++;
          }
        } catch (err) {
          log.error(`[Mealie→Grocy] Failed to process item "${item.id}":`, err);
          summary.failedItems++;
          // Remove from newCheckedState so ONLY this item retries next poll.
          // Other already-processed items are saved normally, preventing double-restocking.
          delete newCheckedState[item.id];
        }
      }
      // B3 edge case: un-checking is ignored (Scenario 10)
    }

    state.mealieCheckedItems = newCheckedState;
    state.lastMealiePoll = new Date();
    await saveSyncState(state);

    return {
      status: summary.failedItems > 0 ? 'partial' : 'ok',
      summary,
    };
  } catch (error) {
    log.error('[Mealie→Grocy] Error polling Mealie:', error);
    return {
      status: 'error',
      summary,
    };
  }
}

/** Process a checked item: add stock in Grocy and clean up Grocy shopping list.
 *  Returns the grocyProductId if stock was successfully added, or null if skipped. */
async function processCheckedItem(item: ShoppingListItemOut_Output): Promise<number | null> {
  const foodId = item.foodId;
  if (!foodId) {
    // Ad-hoc item without mapped food — skip gracefully (Scenario 11)
    log.info(`[Mealie→Grocy] Skipping unmapped item "${item.note || item.display || item.id}" (no foodId)`);
    return null;
  }

  // Look up product mapping
  const mappings = await db.select()
    .from(productMappings)
    .where(eq(productMappings.mealieFoodId, foodId))
    .limit(1);

  if (mappings.length === 0) {
    log.warn(`[Mealie→Grocy] No mapping found for Mealie food ${foodId}, skipping`);
    return null;
  }

  const mapping = mappings[0];
  // Mealie can send 0 or omit quantity for checked shopping items.
  // We intentionally treat that as a purchase of 1 item to preserve the
  // "check off means bought one" workflow in Grocy.
  const quantity = item.quantity || 1;

  // Check if we should only add stock for products with min_stock_amount > 0
  if (await resolveStockOnlyMinStock()) {
    try {
      const productDetails = await getProductDetails(mapping.grocyProductId);
      const minStock = Number(productDetails.product?.min_stock_amount ?? 0);
      if (minStock <= 0) {
        log.info(`[Mealie→Grocy] Skipping "${mapping.grocyProductName}" — no min stock set (STOCK_ONLY_MIN_STOCK=true)`);
        return null;
      }
    } catch (error) {
      log.warn(`[Mealie→Grocy] Could not check min_stock for "${mapping.grocyProductName}", proceeding anyway:`, error);
    }
  }

  // B3.2: Add stock in Grocy
  log.info(`[Mealie→Grocy] Adding stock: "${mapping.grocyProductName}" qty=${quantity} to Grocy`);

  try {
    await addProductStock(mapping.grocyProductId, quantity);
  } catch (error) {
    log.error(`[Mealie→Grocy] Failed to add stock for "${mapping.grocyProductName}":`, error);
    // Propagate to caller — the poll loop catches this per-item and leaves
    // the item out of newCheckedState so it retries on the next poll.
    throw error;
  }

  // B3.4: Remove from Grocy shopping list
  try {
    const grocyShoppingItems = await getGrocyEntities('shopping_list');

    const matchingItems = grocyShoppingItems.filter(
      si => Number(si.product_id) === mapping.grocyProductId
    );

    for (const si of matchingItems) {
      if (si.id != null) {
        await deleteGrocyEntity('shopping_list', si.id);
        log.info(`[Mealie→Grocy] Removed "${mapping.grocyProductName}" from Grocy shopping list`);
      }
    }
  } catch (error) {
    // Non-critical: log but don't fail the whole operation
    log.warn(`[Mealie→Grocy] Could not clean Grocy shopping list for "${mapping.grocyProductName}":`, error);
  }

  return mapping.grocyProductId;
}

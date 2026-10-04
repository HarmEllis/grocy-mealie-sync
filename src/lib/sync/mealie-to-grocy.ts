import { db } from '../db';
import { productMappings } from '../db/schema';
import { getGrocyEntities, deleteGrocyEntity, getProductDetails, addProductStock } from '../grocy/types';
import type { GrocyProductWithParent } from '../grocy/types';
import type { ShoppingListItemOut_Output } from '../mealie/client/models/ShoppingListItemOut_Output';
import { log } from '../logger';
import { resolveShoppingListId, resolveStockOnlyMinStock } from '../settings';
import { getSyncState, saveSyncState, type SyncStateData } from './state';
import { fetchAllMealieShoppingItems } from './helpers';
import { eq } from 'drizzle-orm';
import type { HistoryEventInput } from '../history-store';
import { activityEvent, describeSyncError } from './activity';
import {
  GMS_ITEMS_KEY,
  isValidSubProductItem,
  parseSubProductNoteAmounts,
  type SubProductItem,
} from '../shopping-notes';

export interface MealieToGrocySyncSummary {
  checkedItems: number;
  restockedProducts: number;
  failedItems: number;
}

export interface MealieToGrocyPollResult {
  status: 'ok' | 'partial' | 'skipped' | 'error';
  reason?: 'no-shopping-list';
  summary: MealieToGrocySyncSummary;
  events?: HistoryEventInput[];
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
  const events: HistoryEventInput[] = [];
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

    let grocyProductsById = new Map<number, GrocyProductWithParent>();
    try {
      const grocyProducts = await getGrocyEntities('products');
      grocyProductsById = new Map(
        grocyProducts.map(product => [Number(product.id), product as GrocyProductWithParent]),
      );
    } catch (error) {
      log.warn('[Mealie→Grocy] Could not fetch Grocy products for no-own-stock check:', error);
    }
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
        // Record checkedAt for items that are already checked during bootstrap
        if (checked && !state.mealieCheckedAt[item.id]) {
          state.mealieCheckedAt[item.id] = new Date().toISOString();
        }
        continue;
      }

      // Detect newly checked items (B3.1):
      // Was unchecked (or unknown) before, now checked
      const wasChecked = previousCheckedState[item.id];

      // Track when items first become checked (for cleanup scheduler)
      if (checked && wasChecked !== true) {
        state.mealieCheckedAt[item.id] = new Date().toISOString();
      }

      // If unchecked, clear the checked-at, synced and sub-restock progress
      if (!checked) {
        delete state.mealieCheckedAt[item.id];
        delete state.mealieItemsSyncedToGrocy[item.id];
        delete state.mealieSubRestockProgress[item.id];
      }

      if (checked && wasChecked !== true) {
        try {
          const grocyProductId = await processCheckedItem(item, state, grocyProductsById, events);
          if (grocyProductId !== null) {
            // Track that this product was restocked by sync, so Grocy→Mealie
            // won't remove it from the shopping list on the next poll
            state.syncRestockedProducts[String(grocyProductId)] = new Date().toISOString();
            state.mealieItemsSyncedToGrocy[item.id] = new Date().toISOString();
            // Clear sub-restock progress here (not inside processCheckedItem) so that
            // mealieCheckedItems and progress are committed atomically. This prevents
            // double-restocking if the process crashes between the last per-item save
            // and this outer saveSyncState.
            delete state.mealieSubRestockProgress[item.id];
            summary.restockedProducts++;
          }
        } catch (err) {
          log.error(`[Mealie→Grocy] Failed to process item "${item.id}":`, err);
          summary.failedItems++;
          if (!events.some(event => event.level === 'error' && (event.details as { mealieItemId?: string } | undefined)?.mealieItemId === item.id)) events.push(activityEvent({
            level: 'error', source: 'Mealie', target: 'Grocy',
            productName: item.food?.name ?? item.display ?? item.note ?? undefined,
            entityRef: item.id, message: `Could not process checked Mealie item: ${describeSyncError(err)}`,
            reason: 'Item checked off on the Mealie shopping list. Failed stock additions will be retried.',
            details: { mealieItemId: item.id, mealieFoodId: item.foodId, error: describeSyncError(err) },
          }));
          // Remove from newCheckedState so ONLY this item retries next poll.
          // Other already-processed items are saved normally, preventing double-restocking.
          delete newCheckedState[item.id];
          // Also remove checkedAt so it gets a fresh timestamp on retry
          delete state.mealieCheckedAt[item.id];
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
      events,
    };
  } catch (error) {
    log.error('[Mealie→Grocy] Error polling Mealie:', error);
    events.push(activityEvent({
      level: 'error', source: 'Mealie', target: 'Grocy', message: `Mealie to Grocy sync failed: ${describeSyncError(error)}`,
      reason: 'Could not complete the shopping list sync.', details: { error: describeSyncError(error) },
    }));
    return {
      status: 'error',
      summary,
      events,
    };
  }
}

/** Process a checked item: add stock in Grocy and clean up Grocy shopping list.
 *  Returns the grocyProductId if stock was successfully added, or null if skipped. */
async function processCheckedItem(item: ShoppingListItemOut_Output, state: SyncStateData, grocyProductsById: Map<number, GrocyProductWithParent>, events: HistoryEventInput[]): Promise<number | null> {
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
    events.push(activityEvent({
      level: 'warning', source: 'Mealie', target: 'Grocy', productName: item.food?.name ?? item.display ?? undefined,
      entityRef: item.id, message: `Could not restock "${item.food?.name ?? item.display ?? foodId}" in Grocy.`,
      reason: 'The checked Mealie item has no linked Grocy product.', details: { mealieItemId: item.id, mealieFoodId: foodId },
    }));
    return null;
  }

  const mapping = mappings[0];
  const recordStockAdded = (productId: number, productName: string, amount: number, amountSource: string) => {
    events.push(activityEvent({
      source: 'Mealie', target: 'Grocy', productName, entityRef: `grocy:${productId}`,
      category: 'inventory', message: `Added ${amount} to Grocy stock for "${productName}".`,
      reason: `"${mapping.mealieFoodName}" was checked off on the Mealie shopping list.`,
      details: { grocyProductId: productId, mealieFoodId: foodId, mealieFoodName: mapping.mealieFoodName, mealieItemId: item.id, amount, amountSource },
    }));
  };

  // Sub-product path: if this item was placed on the list by sub-product sync,
  // restock each sub-product individually using note amounts (user-editable) with
  // extras amounts as fallback. Sub-products were added because they were below
  // min stock by construction, so STOCK_ONLY_MIN_STOCK is always satisfied.
  const rawSubItemsValue = (item.extras as Record<string, unknown> | undefined)?.[GMS_ITEMS_KEY];
  const rawSubItems: unknown = typeof rawSubItemsValue === 'string'
    ? (() => { try { return JSON.parse(rawSubItemsValue); } catch { return null; } })()
    : rawSubItemsValue;
  if (Array.isArray(rawSubItems) && rawSubItems.length > 0 && rawSubItems.every(isValidSubProductItem)) {
    const subItems = rawSubItems as SubProductItem[];
    const names = subItems.map(s => s.name);
    const hasDuplicateNames = new Set(names).size !== names.length;
    if (hasDuplicateNames) {
      log.info(`[Mealie→Grocy] Duplicate sub-product names in "${mapping.grocyProductName}" — note overrides disabled`);
    }
    const noteAmounts = hasDuplicateNames ? null : parseSubProductNoteAmounts(item.note);
    const progress = state.mealieSubRestockProgress[item.id] ?? [];
    const failed: string[] = [];

    for (const sub of subItems) {
      if (progress.includes(sub.grocyProductId)) {
        log.info(`[Mealie→Grocy] "${sub.name}" already restocked in previous attempt — skipping`);
        continue;
      }
      const subProduct = grocyProductsById.get(sub.grocyProductId);
      const subNoOwnStockRaw = Number(subProduct?.no_own_stock);
      if (subProduct && Number.isFinite(subNoOwnStockRaw) && subNoOwnStockRaw !== 0) {
        log.info(`[Mealie→Grocy] Skipping "${sub.name}" — product has no own stock in Grocy`);
        progress.push(sub.grocyProductId);
        state.mealieSubRestockProgress[item.id] = [...progress];
        continue;
      }
      const amount = noteAmounts?.get(sub.name) ?? sub.amount;
      const source = noteAmounts?.has(sub.name) ? 'note' : 'sync data';
      let stockAdded = false;
      try {
        await addProductStock(sub.grocyProductId, amount);
        stockAdded = true;
        recordStockAdded(sub.grocyProductId, sub.name, amount, source);
        log.info(`[Mealie→Grocy] Restocked "${sub.name}" qty=${amount} (from ${source})`);
        progress.push(sub.grocyProductId);
        state.mealieSubRestockProgress[item.id] = [...progress];
        await saveSyncState(state);
      } catch (err) {
        events.push(activityEvent({
          level: 'error', source: 'Mealie', target: 'Grocy', productName: sub.name,
          entityRef: `grocy:${sub.grocyProductId}`, message: stockAdded
            ? `Added stock for "${sub.name}", but saving restock progress failed: ${describeSyncError(err)}`
            : `Could not add ${amount} to Grocy stock for "${sub.name}": ${describeSyncError(err)}`,
          reason: `"${mapping.mealieFoodName}" was checked off on the Mealie shopping list.`,
          details: { grocyProductId: sub.grocyProductId, mealieItemId: item.id, amount, error: describeSyncError(err) },
        }));
        log.error(`[Mealie→Grocy] Failed to restock sub-product "${sub.name}":`, err);
        failed.push(sub.name);
      }
    }

    if (failed.length > 0) {
      throw new Error(`Sub-product restock failed for: ${failed.join(', ')}`);
    }

    // Do NOT clear mealieSubRestockProgress here. The outer poll clears it
    // atomically with the final saveSyncState so that a crash between this
    // point and the outer commit cannot cause a double-restock on the next poll.

    // Clean up the parent product from Grocy shopping list (same as normal path)
    try {
      const grocyShoppingItems = await getGrocyEntities('shopping_list');
      const matchingItems = grocyShoppingItems.filter(
        si => Number(si.product_id) === mapping.grocyProductId
      );
      for (const si of matchingItems) {
        if (si.id != null) {
          await deleteGrocyEntity('shopping_list', si.id);
          recordShoppingRemoval(events, mapping, item.id, si.id);
          log.info(`[Mealie→Grocy] Removed "${mapping.grocyProductName}" from Grocy shopping list`);
        }
      }
    } catch (error) {
      recordShoppingCleanupFailure(events, mapping, item.id, error);
      log.warn(`[Mealie→Grocy] Could not clean Grocy shopping list for "${mapping.grocyProductName}":`, error);
    }

    return mapping.grocyProductId;
  }

  // Stale progress from a previous sub-product attempt is no longer applicable
  // if the item now takes the normal path (e.g. extras changed/became invalid).
  delete state.mealieSubRestockProgress[item.id];

  // Mealie can send 0 or omit quantity for checked shopping items.
  // We intentionally treat that as a purchase of 1 item to preserve the
  // "check off means bought one" workflow in Grocy.
  const quantity = item.quantity || 1;

  const grocyProduct = grocyProductsById.get(mapping.grocyProductId);
  const noOwnStockRaw = Number(grocyProduct?.no_own_stock);
  if (grocyProduct && Number.isFinite(noOwnStockRaw) && noOwnStockRaw !== 0) {
    log.info(`[Mealie→Grocy] Skipping "${mapping.grocyProductName}" — product has no own stock in Grocy`);
    return null;
  }

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
    recordStockAdded(mapping.grocyProductId, mapping.grocyProductName, quantity, item.quantity ? 'shopping list quantity' : 'default quantity');
  } catch (error) {
    log.error(`[Mealie→Grocy] Failed to add stock for "${mapping.grocyProductName}":`, error);
    events.push(activityEvent({
      level: 'error', source: 'Mealie', target: 'Grocy', productName: mapping.grocyProductName,
      category: 'inventory', entityRef: `grocy:${mapping.grocyProductId}`,
      message: `Could not add ${quantity} to Grocy stock for "${mapping.grocyProductName}": ${describeSyncError(error)}`,
      reason: `"${mapping.mealieFoodName}" was checked off on the Mealie shopping list.`,
      details: { grocyProductId: mapping.grocyProductId, mealieFoodId: foodId, mealieItemId: item.id, amount: quantity, error: describeSyncError(error) },
    }));
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
        recordShoppingRemoval(events, mapping, item.id, si.id);
        log.info(`[Mealie→Grocy] Removed "${mapping.grocyProductName}" from Grocy shopping list`);
      }
    }
  } catch (error) {
    // Non-critical: log but don't fail the whole operation
    recordShoppingCleanupFailure(events, mapping, item.id, error);
    log.warn(`[Mealie→Grocy] Could not clean Grocy shopping list for "${mapping.grocyProductName}":`, error);
  }

  return mapping.grocyProductId;
}

function recordShoppingRemoval(events: HistoryEventInput[], mapping: { grocyProductId: number; grocyProductName: string; mealieFoodName: string }, mealieItemId: string, shoppingItemId: number) {
  events.push(activityEvent({
    source: 'Mealie', target: 'Grocy', productName: mapping.grocyProductName,
    category: 'shopping', entityKind: 'shopping_item', entityRef: `grocy:${mapping.grocyProductId}`,
    message: `Removed "${mapping.grocyProductName}" from the Grocy shopping list.`,
    reason: `"${mapping.mealieFoodName}" was checked off in Mealie and its stock was processed.`,
    details: { grocyProductId: mapping.grocyProductId, mealieItemId, shoppingItemId },
  }));
}

function recordShoppingCleanupFailure(events: HistoryEventInput[], mapping: { grocyProductId: number; grocyProductName: string }, mealieItemId: string, error: unknown) {
  events.push(activityEvent({
    level: 'warning', source: 'Mealie', target: 'Grocy', productName: mapping.grocyProductName,
    category: 'shopping', entityRef: `grocy:${mapping.grocyProductId}`,
    message: `Stock processed, but Grocy shopping list cleanup failed: ${describeSyncError(error)}`,
    reason: 'The Mealie item was checked off. Stock will not be added again for this cleanup failure.',
    details: { grocyProductId: mapping.grocyProductId, mealieItemId, error: describeSyncError(error) },
  }));
}

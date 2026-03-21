import { db } from '../db';
import { productMappings, unitMappings } from '../db/schema';
import { StockService, GenericEntityInteractionsService } from '../grocy/client';
import { HouseholdsShoppingListItemsService } from '../mealie/client';
import type { ShoppingListItemOut_Output } from '../mealie/client/models/ShoppingListItemOut_Output';
import { config } from '../config';
import { log } from '../logger';
import { getSyncState, saveSyncState } from './state';
import { eq } from 'drizzle-orm';

export async function pollMealieForCheckedItems(): Promise<void> {
  log.info('[Mealie→Grocy] Polling for checked items...');

  try {
    // Fetch all items on the configured shopping list
    const itemsRes = await HouseholdsShoppingListItemsService.getAllApiHouseholdsShoppingItemsGet(
      undefined, undefined, undefined,
      `shoppingListId=${config.mealieShoppingListId}`,
      undefined, 1, 500
    );

    const items = itemsRes.items || [];
    const state = await getSyncState();
    const previousCheckedState = state.mealieCheckedItems;
    const newCheckedState: Record<string, boolean> = {};

    for (const item of items) {
      const checked = item.checked ?? false;
      newCheckedState[item.id] = checked;

      // Detect newly checked items (B3.1):
      // Was unchecked (or unknown) before, now checked
      const wasChecked = previousCheckedState[item.id];
      if (checked && wasChecked !== true) {
        await processCheckedItem(item);
      }
      // B3 edge case: un-checking is ignored (Scenario 10)
    }

    state.mealieCheckedItems = newCheckedState;
    state.lastMealiePoll = new Date();
    await saveSyncState(state);
  } catch (error) {
    log.error('[Mealie→Grocy] Error polling Mealie:', error);
  }
}

async function processCheckedItem(item: ShoppingListItemOut_Output): Promise<void> {
  const foodId = item.foodId;
  if (!foodId) {
    // Ad-hoc item without mapped food — skip gracefully (Scenario 11)
    log.info(`[Mealie→Grocy] Skipping unmapped item "${item.note || item.display || item.id}" (no foodId)`);
    return;
  }

  // Look up product mapping
  const mappings = await db.select()
    .from(productMappings)
    .where(eq(productMappings.mealieFoodId, foodId))
    .limit(1);

  if (mappings.length === 0) {
    log.warn(`[Mealie→Grocy] No mapping found for Mealie food ${foodId}, skipping`);
    return;
  }

  const mapping = mappings[0];
  const quantity = item.quantity || 1;

  // Check if we should only add stock for products with min_stock_amount > 0
  if (config.stockOnlyMinStock) {
    try {
      const productDetails = await StockService.getStockProducts(mapping.grocyProductId) as any;
      const minStock = Number(productDetails.product?.min_stock_amount ?? 0);
      if (minStock <= 0) {
        log.info(`[Mealie→Grocy] Skipping "${mapping.grocyProductName}" — no min stock set (STOCK_ONLY_MIN_STOCK=true)`);
        return;
      }
    } catch (error) {
      log.warn(`[Mealie→Grocy] Could not check min_stock for "${mapping.grocyProductName}", proceeding anyway:`, error);
    }
  }

  // B3.2: Add stock in Grocy
  log.info(`[Mealie→Grocy] Adding stock: "${mapping.grocyProductName}" qty=${quantity} to Grocy`);

  try {
    await StockService.postStockProductsAdd(mapping.grocyProductId, {
      amount: quantity,
      transaction_type: 'purchase' as any,
    });
  } catch (error) {
    log.error(`[Mealie→Grocy] Failed to add stock for "${mapping.grocyProductName}":`, error);
    // Don't mark as processed — will retry on next poll
    throw error;
  }

  // B3.4: Remove from Grocy shopping list
  try {
    const grocyShoppingItems = await GenericEntityInteractionsService.getObjects(
      'shopping_list' as any,
    ) as any[];

    const matchingItems = grocyShoppingItems.filter(
      (si: any) => si.product_id === mapping.grocyProductId
    );

    for (const si of matchingItems) {
      await GenericEntityInteractionsService.deleteObjects(
        'shopping_list' as any,
        si.id,
      );
      log.info(`[Mealie→Grocy] Removed "${mapping.grocyProductName}" from Grocy shopping list`);
    }
  } catch (error) {
    // Non-critical: log but don't fail the whole operation
    log.warn(`[Mealie→Grocy] Could not clean Grocy shopping list for "${mapping.grocyProductName}":`, error);
  }
}

import { db } from '../db';
import { productMappings, unitMappings } from '../db/schema';
import { getVolatileStock } from '../grocy/types';
import type { GrocyMissingProduct } from '../grocy/types';
import { HouseholdsShoppingListItemsService } from '../mealie';
import type { MealieShoppingItem } from '../mealie/types';
import { log } from '../logger';
import { resolveEnsureLowStockOnMealieList, resolveShoppingListId } from '../settings';
import { getSyncState, saveSyncState } from './state';
import { fetchAllMealieShoppingItems } from './helpers';
import { eq } from 'drizzle-orm';

interface PollGrocyForMissingStockOptions {
  ensureAllPresent?: boolean;
}

interface AdjustMealieShoppingItemOptions {
  createQuantityWhenMissing?: number;
  grocyProductName?: string;
}

export async function pollGrocyForMissingStock(
  options: PollGrocyForMissingStockOptions = {},
): Promise<void> {
  log.info('[Grocy→Mealie] Polling for missing stock...');

  const shoppingListId = await resolveShoppingListId();
  if (!shoppingListId) {
    log.warn('[Grocy→Mealie] No shopping list configured — skipping poll');
    return;
  }

  try {
    const ensureAllPresent = options.ensureAllPresent ?? await resolveEnsureLowStockOnMealieList();
    const volatile = await getVolatileStock();
    const missingProducts: GrocyMissingProduct[] = volatile.missing_products || [];

    const state = await getSyncState();
    const previousAmounts = state.grocyBelowMinStock; // Record<number, number>

    const currentAmounts: Record<number, number> = {};
    for (const mp of missingProducts) {
      currentAmounts[mp.id] = mp.amount_missing;
    }

    // Fetch all Mealie shopping list items once, to be reused across all adjustments
    const mealieShoppingItems = await fetchAllMealieShoppingItems(shoppingListId);

    // 1. Newly missing → add to Mealie
    const newlyMissing = missingProducts.filter(mp => !(mp.id in previousAmounts));
    let newlyAdded = 0;
    for (const mp of newlyMissing) {
      if (await adjustMealieShoppingItem(mp.id, mp.amount_missing, shoppingListId, mealieShoppingItems, {
        grocyProductName: mp.name,
      })) newlyAdded++;
    }

    // 2. Still missing, amount changed → adjust by delta
    const amountChanged = missingProducts.filter(mp =>
      mp.id in previousAmounts && previousAmounts[mp.id] !== mp.amount_missing
    );
    let adjusted = 0;
    for (const mp of amountChanged) {
      const delta = mp.amount_missing - previousAmounts[mp.id];
      if (await adjustMealieShoppingItem(mp.id, delta, shoppingListId, mealieShoppingItems, {
        createQuantityWhenMissing: ensureAllPresent ? mp.amount_missing : undefined,
        grocyProductName: mp.name,
      })) adjusted++;
    }

    // 2b. Still missing, amount unchanged → optionally recreate the item if
    // it was manually removed from Mealie while the product is still below min.
    const unchangedMissing = ensureAllPresent
      ? missingProducts.filter(mp => mp.id in previousAmounts && previousAmounts[mp.id] === mp.amount_missing)
      : [];
    for (const mp of unchangedMissing) {
      await adjustMealieShoppingItem(mp.id, 0, shoppingListId, mealieShoppingItems, {
        createQuantityWhenMissing: mp.amount_missing,
        grocyProductName: mp.name,
      });
    }

    // 3. No longer missing → subtract Grocy's contribution
    //    BUT skip products that were restocked by the Mealie→Grocy sync
    //    (to prevent the feedback loop where sync-added stock triggers list removal)
    const noLongerMissing = Object.keys(previousAmounts)
      .map(Number)
      .filter(id => !(id in currentAmounts));
    let restocked = 0;
    let skippedSyncRestocked = 0;
    for (const grocyProductId of noLongerMissing) {
      if (grocyProductId in state.syncRestockedProducts) {
        const name = await resolveGrocyProductName(grocyProductId);
        log.info(`[Grocy→Mealie] Skipping removal for "${name}" — restocked by sync, not manually`);
        delete state.syncRestockedProducts[grocyProductId];
        skippedSyncRestocked++;
        continue;
      }
      if (await adjustMealieShoppingItem(grocyProductId, -previousAmounts[grocyProductId], shoppingListId, mealieShoppingItems)) restocked++;
    }

    if (newlyMissing.length > 0) {
      log.info(`[Grocy→Mealie] ${newlyAdded}/${newlyMissing.length} newly missing product(s) added to shopping list`);
    }
    if (amountChanged.length > 0) {
      log.info(`[Grocy→Mealie] ${adjusted}/${amountChanged.length} product(s) quantity adjusted`);
    }
    if (ensureAllPresent && unchangedMissing.length > 0) {
      log.info(`[Grocy→Mealie] Presence check completed for ${unchangedMissing.length} still-missing product(s)`);
    }
    if (noLongerMissing.length > 0) {
      const manuallyRestocked = noLongerMissing.length - skippedSyncRestocked;
      if (manuallyRestocked > 0) {
        log.info(`[Grocy→Mealie] ${restocked}/${manuallyRestocked} manually restocked product(s) adjusted on shopping list`);
      }
      if (skippedSyncRestocked > 0) {
        log.info(`[Grocy→Mealie] ${skippedSyncRestocked} product(s) skipped (restocked by sync, not user)`);
      }
    }

    // Clear all syncRestockedProducts entries after processing.
    // Each entry only needs to survive one Grocy→Mealie poll cycle:
    // - If the product was "no longer missing", the entry was checked and skip applied
    // - If the product is still partially missing, no removal was attempted anyway
    // - Clearing prevents stale entries from blocking future manual restocks
    state.syncRestockedProducts = {};

    state.grocyBelowMinStock = currentAmounts;
    state.lastGrocyPoll = new Date();
    await saveSyncState(state);
  } catch (error) {
    log.error('[Grocy→Mealie] Error polling Grocy:', error);
  }
}

export async function ensureGrocyMissingStockOnMealie(): Promise<void> {
  await pollGrocyForMissingStock({ ensureAllPresent: true });
}

/**
 * Adjust a Mealie shopping list item's quantity by a delta.
 * Positive delta: increase quantity (or create item).
 * Negative delta: decrease quantity (or remove item if result ≤ 0).
 * Zero delta: only create the item when createQuantityWhenMissing is supplied.
 *
 * @param mealieShoppingItems Pre-fetched list of all current Mealie shopping items (avoids N+1 fetches).
 */
async function adjustMealieShoppingItem(
  grocyProductId: number,
  delta: number,
  shoppingListId: string,
  mealieShoppingItems: MealieShoppingItem[],
  options: AdjustMealieShoppingItemOptions = {},
): Promise<boolean> {
  const mappings = await db.select()
    .from(productMappings)
    .where(eq(productMappings.grocyProductId, grocyProductId))
    .limit(1);

  if (mappings.length === 0) {
    const productNameSuffix = options.grocyProductName ? ` ("${options.grocyProductName}")` : '';
    log.warn(`[Grocy→Mealie] No mapping found for Grocy product ID ${grocyProductId}${productNameSuffix}, skipping`);
    return false;
  }

  const mapping = mappings[0];

  // Resolve Mealie unit from mapping
  let unitId: string | undefined;
  if (mapping.unitMappingId) {
    const units = await db.select()
      .from(unitMappings)
      .where(eq(unitMappings.id, mapping.unitMappingId))
      .limit(1);
    if (units.length > 0) {
      unitId = units[0].mealieUnitId;
    }
  }

  // Find existing unchecked item on the list using pre-fetched items
  const existingItem = mealieShoppingItems.find(item =>
    item.foodId === mapping.mealieFoodId && !item.checked
  );

  if (existingItem) {
    if (delta === 0) {
      return true;
    }

    const currentQty = existingItem.quantity || 0;
    const newQty = currentQty + delta;

    if (newQty <= 0) {
      // Remove item entirely
      await HouseholdsShoppingListItemsService.deleteOneApiHouseholdsShoppingItemsItemIdDelete(existingItem.id);
      log.info(`[Grocy→Mealie] Removed "${mapping.mealieFoodName}" from list (qty ${currentQty} → 0)`);
    } else {
      // Update quantity
      log.info(`[Grocy→Mealie] Adjusting "${mapping.mealieFoodName}" quantity: ${currentQty} → ${newQty} (delta: ${delta > 0 ? '+' : ''}${delta})`);
      await HouseholdsShoppingListItemsService.updateOneApiHouseholdsShoppingItemsItemIdPut(
        existingItem.id,
        {
          shoppingListId: shoppingListId,
          quantity: newQty,
          foodId: mapping.mealieFoodId,
          unitId: unitId || undefined,
        }
      );
    }
  } else {
    const createQuantity = options.createQuantityWhenMissing ?? delta;
    if (createQuantity <= 0) {
      return true;
    }

    // No existing item, create new one
    log.info(`[Grocy→Mealie] Adding "${mapping.mealieFoodName}" to Mealie shopping list (qty: ${createQuantity})`);
    await HouseholdsShoppingListItemsService.createOneApiHouseholdsShoppingItemsPost({
      shoppingListId: shoppingListId,
      foodId: mapping.mealieFoodId,
      unitId: unitId || undefined,
      quantity: createQuantity,
      checked: false,
    });
  }
  return true;
}

async function resolveGrocyProductName(grocyProductId: number): Promise<string> {
  const mappings = await db.select()
    .from(productMappings)
    .where(eq(productMappings.grocyProductId, grocyProductId))
    .limit(1);
  return mappings.length > 0 ? mappings[0].grocyProductName : `product #${grocyProductId}`;
}

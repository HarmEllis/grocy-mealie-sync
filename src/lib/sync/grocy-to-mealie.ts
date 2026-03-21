import { db } from '../db';
import { productMappings, unitMappings } from '../db/schema';
import { StockService } from '../grocy';
import { HouseholdsShoppingListItemsService } from '../mealie';
import { log } from '../logger';
import { resolveShoppingListId } from '../settings';
import { getSyncState, saveSyncState } from './state';
import { eq } from 'drizzle-orm';

interface MissingProduct {
  id: number;
  name: string;
  amount_missing: number;
  is_partly_in_stock: number;
}

export async function pollGrocyForMissingStock(): Promise<void> {
  log.info('[Grocy→Mealie] Polling for missing stock...');

  const shoppingListId = await resolveShoppingListId();
  if (!shoppingListId) {
    log.warn('[Grocy→Mealie] No shopping list configured — skipping poll');
    return;
  }

  try {
    const volatile = await StockService.getStockVolatile() as any;
    const missingProducts: MissingProduct[] = volatile.missing_products || [];

    const state = await getSyncState();
    const previousAmounts = state.grocyBelowMinStock; // Record<number, number>

    const currentAmounts: Record<number, number> = {};
    for (const mp of missingProducts) {
      currentAmounts[mp.id] = mp.amount_missing;
    }

    // 1. Newly missing → add to Mealie
    const newlyMissing = missingProducts.filter(mp => !(mp.id in previousAmounts));
    let newlyAdded = 0;
    for (const mp of newlyMissing) {
      if (await adjustMealieShoppingItem(mp.id, mp.amount_missing, shoppingListId)) newlyAdded++;
    }

    // 2. Still missing, amount changed → adjust by delta
    const amountChanged = missingProducts.filter(mp =>
      mp.id in previousAmounts && previousAmounts[mp.id] !== mp.amount_missing
    );
    let adjusted = 0;
    for (const mp of amountChanged) {
      const delta = mp.amount_missing - previousAmounts[mp.id];
      if (await adjustMealieShoppingItem(mp.id, delta, shoppingListId)) adjusted++;
    }

    // 3. No longer missing → subtract Grocy's contribution
    const noLongerMissing = Object.keys(previousAmounts)
      .map(Number)
      .filter(id => !(id in currentAmounts));
    let restocked = 0;
    for (const grocyProductId of noLongerMissing) {
      if (await adjustMealieShoppingItem(grocyProductId, -previousAmounts[grocyProductId], shoppingListId)) restocked++;
    }

    if (newlyMissing.length > 0) {
      log.info(`[Grocy→Mealie] ${newlyAdded}/${newlyMissing.length} newly missing product(s) added to shopping list`);
    }
    if (amountChanged.length > 0) {
      log.info(`[Grocy→Mealie] ${adjusted}/${amountChanged.length} product(s) quantity adjusted`);
    }
    if (noLongerMissing.length > 0) {
      log.info(`[Grocy→Mealie] ${restocked}/${noLongerMissing.length} restocked product(s) adjusted on shopping list`);
    }

    state.grocyBelowMinStock = currentAmounts;
    state.lastGrocyPoll = new Date();
    await saveSyncState(state);
  } catch (error) {
    log.error('[Grocy→Mealie] Error polling Grocy:', error);
  }
}

/**
 * Adjust a Mealie shopping list item's quantity by a delta.
 * Positive delta: increase quantity (or create item).
 * Negative delta: decrease quantity (or remove item if result ≤ 0).
 */
async function adjustMealieShoppingItem(grocyProductId: number, delta: number, shoppingListId: string): Promise<boolean> {
  const mappings = await db.select()
    .from(productMappings)
    .where(eq(productMappings.grocyProductId, grocyProductId))
    .limit(1);

  if (mappings.length === 0) {
    log.warn(`[Grocy→Mealie] No mapping found for Grocy product ID ${grocyProductId}, skipping`);
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

  // Find existing unchecked item on the list
  const existingItems = await HouseholdsShoppingListItemsService.getAllApiHouseholdsShoppingItemsGet(
    undefined, undefined, undefined,
    `shoppingListId=${shoppingListId}`,
    undefined, 1, 500
  );

  const items = existingItems.items || [];
  const existingItem = items.find(item =>
    item.foodId === mapping.mealieFoodId && !item.checked
  );

  if (existingItem) {
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
  } else if (delta > 0) {
    // No existing item, create new one
    log.info(`[Grocy→Mealie] Adding "${mapping.mealieFoodName}" to Mealie shopping list (qty: ${delta})`);
    await HouseholdsShoppingListItemsService.createOneApiHouseholdsShoppingItemsPost({
      shoppingListId: shoppingListId,
      foodId: mapping.mealieFoodId,
      unitId: unitId || undefined,
      quantity: delta,
      checked: false,
    });
  } else {
    // No existing item and delta ≤ 0, nothing to do
    return true;
  }
  return true;
}

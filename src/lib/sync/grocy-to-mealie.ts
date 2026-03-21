import { db } from '../db';
import { productMappings, unitMappings } from '../db/schema';
import { StockService } from '../grocy/client';
import { HouseholdsShoppingListItemsService } from '../mealie/client';
import { config } from '../config';
import { log } from '../logger';
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
    for (const mp of newlyMissing) {
      await upsertMealieShoppingItem(mp.id, mp.amount_missing);
    }

    // 2. Still missing, amount changed → update quantity in Mealie
    const amountChanged = missingProducts.filter(mp =>
      mp.id in previousAmounts && previousAmounts[mp.id] !== mp.amount_missing
    );
    for (const mp of amountChanged) {
      await upsertMealieShoppingItem(mp.id, mp.amount_missing);
    }

    // 3. No longer missing → remove from Mealie
    const noLongerMissing = Object.keys(previousAmounts)
      .map(Number)
      .filter(id => !(id in currentAmounts));
    for (const grocyProductId of noLongerMissing) {
      await removeMealieShoppingItem(grocyProductId);
    }

    if (newlyMissing.length > 0) {
      log.info(`[Grocy→Mealie] ${newlyMissing.length} newly missing product(s) added`);
    }
    if (amountChanged.length > 0) {
      log.info(`[Grocy→Mealie] ${amountChanged.length} product(s) quantity updated`);
    }
    if (noLongerMissing.length > 0) {
      log.info(`[Grocy→Mealie] ${noLongerMissing.length} product(s) no longer missing, removed from list`);
    }

    state.grocyBelowMinStock = currentAmounts;
    state.lastGrocyPoll = new Date();
    await saveSyncState(state);
  } catch (error) {
    log.error('[Grocy→Mealie] Error polling Grocy:', error);
  }
}

async function upsertMealieShoppingItem(grocyProductId: number, amountMissing: number): Promise<void> {
  const mappings = await db.select()
    .from(productMappings)
    .where(eq(productMappings.grocyProductId, grocyProductId))
    .limit(1);

  if (mappings.length === 0) {
    log.warn(`[Grocy→Mealie] No mapping found for Grocy product ID ${grocyProductId}, skipping`);
    return;
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

  // Check for existing unchecked item
  const existingItems = await HouseholdsShoppingListItemsService.getAllApiHouseholdsShoppingItemsGet(
    undefined, undefined, undefined,
    `shoppingListId=${config.mealieShoppingListId}`,
    undefined, 1, 500
  );

  const items = existingItems.items || [];
  const existingItem = items.find(item =>
    item.foodId === mapping.mealieFoodId && !item.checked
  );

  if (existingItem) {
    log.info(`[Grocy→Mealie] Updating "${mapping.mealieFoodName}" quantity: ${existingItem.quantity} → ${amountMissing}`);

    await HouseholdsShoppingListItemsService.updateOneApiHouseholdsShoppingItemsItemIdPut(
      existingItem.id,
      {
        shoppingListId: config.mealieShoppingListId,
        quantity: amountMissing,
        foodId: mapping.mealieFoodId,
        unitId: unitId || undefined,
      }
    );
  } else {
    log.info(`[Grocy→Mealie] Adding "${mapping.mealieFoodName}" to Mealie shopping list (qty: ${amountMissing})`);

    await HouseholdsShoppingListItemsService.createOneApiHouseholdsShoppingItemsPost({
      shoppingListId: config.mealieShoppingListId,
      foodId: mapping.mealieFoodId,
      unitId: unitId || undefined,
      quantity: amountMissing,
      checked: false,
    });
  }
}

async function removeMealieShoppingItem(grocyProductId: number): Promise<void> {
  const mappings = await db.select()
    .from(productMappings)
    .where(eq(productMappings.grocyProductId, grocyProductId))
    .limit(1);

  if (mappings.length === 0) return;

  const mapping = mappings[0];

  try {
    const existingItems = await HouseholdsShoppingListItemsService.getAllApiHouseholdsShoppingItemsGet(
      undefined, undefined, undefined,
      `shoppingListId=${config.mealieShoppingListId}`,
      undefined, 1, 500
    );

    const items = existingItems.items || [];
    const matchingItem = items.find(item =>
      item.foodId === mapping.mealieFoodId && !item.checked
    );

    if (matchingItem) {
      await HouseholdsShoppingListItemsService.deleteOneApiHouseholdsShoppingItemsItemIdDelete(matchingItem.id);
      log.info(`[Grocy→Mealie] Removed "${mapping.mealieFoodName}" from Mealie shopping list (stock replenished)`);
    }
  } catch (error) {
    log.warn(`[Grocy→Mealie] Could not remove "${mapping.mealieFoodName}" from Mealie:`, error);
  }
}

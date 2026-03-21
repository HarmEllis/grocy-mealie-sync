import { db } from '../db';
import { productMappings, unitMappings } from '../db/schema';
import { StockService } from '../grocy/client';
import { HouseholdsShoppingListItemsService } from '../mealie/client';
import { config } from '../config';
import { getSyncState, saveSyncState } from './state';
import { eq } from 'drizzle-orm';

interface MissingProduct {
  id: number;
  name: string;
  amount_missing: number;
  is_partly_in_stock: number;
}

export async function pollGrocyForMissingStock(): Promise<void> {
  console.log('[Grocy→Mealie] Polling for missing stock...');

  try {
    const volatile = await StockService.getStockVolatile() as any;
    const missingProducts: MissingProduct[] = volatile.missing_products || [];

    const state = await getSyncState();
    const previouslyMissing = new Set(state.grocyBelowMinStock);

    const currentlyMissing = new Set<number>();
    for (const mp of missingProducts) {
      currentlyMissing.add(mp.id);
    }

    // Find newly missing products (not in previous poll)
    const newlyMissing = missingProducts.filter(mp => !previouslyMissing.has(mp.id));

    if (newlyMissing.length > 0) {
      console.log(`[Grocy→Mealie] ${newlyMissing.length} newly missing product(s) detected`);
      for (const mp of newlyMissing) {
        await addToMealieShoppingList(mp);
      }
    }

    // Update state
    state.grocyBelowMinStock = Array.from(currentlyMissing);
    state.lastGrocyPoll = new Date();
    await saveSyncState(state);
  } catch (error) {
    console.error('[Grocy→Mealie] Error polling Grocy:', error);
  }
}

async function addToMealieShoppingList(missingProduct: MissingProduct): Promise<void> {
  // Look up product mapping
  const mappings = await db.select()
    .from(productMappings)
    .where(eq(productMappings.grocyProductId, missingProduct.id))
    .limit(1);

  if (mappings.length === 0) {
    console.warn(`[Grocy→Mealie] No mapping found for Grocy product ${missingProduct.name} (ID: ${missingProduct.id}), skipping`);
    return;
  }

  const mapping = mappings[0];

  // Check for existing unchecked item on Mealie shopping list to avoid duplicates (B2.3)
  const existingItems = await HouseholdsShoppingListItemsService.getAllApiHouseholdsShoppingItemsGet(
    undefined, undefined, undefined,
    `shoppingListId=${config.mealieShoppingListId}`,
    undefined, 1, 500
  );

  const items = existingItems.items || [];
  const existingItem = items.find(item =>
    item.foodId === mapping.mealieFoodId && !item.checked
  );

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

  if (existingItem) {
    // Update quantity instead of creating duplicate
    const newQuantity = (existingItem.quantity || 0) + missingProduct.amount_missing;
    console.log(`[Grocy→Mealie] Updating existing item "${mapping.mealieFoodName}" quantity: ${existingItem.quantity} → ${newQuantity}`);

    await HouseholdsShoppingListItemsService.updateOneApiHouseholdsShoppingItemsItemIdPut(
      existingItem.id,
      {
        shoppingListId: config.mealieShoppingListId,
        quantity: newQuantity,
        foodId: mapping.mealieFoodId,
        unitId: unitId || undefined,
      }
    );
  } else {
    console.log(`[Grocy→Mealie] Adding "${mapping.mealieFoodName}" to Mealie shopping list (qty: ${missingProduct.amount_missing})`);

    await HouseholdsShoppingListItemsService.createOneApiHouseholdsShoppingItemsPost({
      shoppingListId: config.mealieShoppingListId,
      foodId: mapping.mealieFoodId,
      unitId: unitId || undefined,
      quantity: missingProduct.amount_missing,
      checked: false,
    });
  }
}

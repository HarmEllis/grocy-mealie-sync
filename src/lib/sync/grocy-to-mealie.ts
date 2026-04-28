import { db } from '../db';
import { productMappings, unitMappings } from '../db/schema';
import { getGrocyEntities, getVolatileStock } from '../grocy/types';
import type { GrocyMissingProduct, GrocyProductWithParent } from '../grocy/types';
import { HouseholdsShoppingListItemsService } from '../mealie';
import type { MealieShoppingItem } from '../mealie/types';
import { log } from '../logger';
import {
  resolveEnsureLowStockOnMealieList,
  resolveShoppingListId,
  resolveSyncSubProducts,
} from '../settings';
import { syncMealieInPossessionFromGrocy, type MealieInPossessionSyncResult } from './mealie-in-possession';
import { getSyncState, saveSyncState } from './state';
import { fetchAllMealieShoppingItems } from './helpers';
import { eq } from 'drizzle-orm';
import {
  GMS_NAMES_KEY,
  GMS_NOTE_KEY,
  GMS_ITEMS_KEY,
  buildSubProductNote,
  replaceSubProductNote,
  type SubProductItem,
} from '../shopping-notes';

// One-time capability detection guard (reset on process restart)
let subProductCapabilityChecked = false;

interface PollGrocyForMissingStockOptions {
  ensureAllPresent?: boolean;
  logUnmappedPresenceCheckProducts?: boolean;
}

interface AdjustMealieShoppingItemOptions {
  createQuantityWhenMissing?: number;
  grocyProductName?: string;
  logWhenMappingMissing?: boolean;
  /** When set, the function computes and writes note/extras for sub-product tracking. */
  subProducts?: SubProductItem[];
}

interface EffectiveMissingEntry {
  effectiveId: number;
  effectiveName: string;
  amount_missing: number;
  subProducts: SubProductItem[];
}

export interface GrocyMissingStockSyncSummary {
  processedProducts: number;
  ensuredProducts: number;
  unmappedProducts: number;
}

export interface GrocyMissingStockPollResult {
  status: 'ok' | 'partial' | 'skipped' | 'error';
  reason?: 'no-shopping-list';
  inPossessionStatus?: MealieInPossessionSyncResult['status'];
  inPossessionSummary?: MealieInPossessionSyncResult['summary'];
  summary: GrocyMissingStockSyncSummary;
}

type AdjustMealieShoppingItemResult = 'ensured' | 'unmapped';

function createEmptySummary(): GrocyMissingStockSyncSummary {
  return {
    processedProducts: 0,
    ensuredProducts: 0,
    unmappedProducts: 0,
  };
}

function recordMissingStockResult(
  summary: GrocyMissingStockSyncSummary,
  result: AdjustMealieShoppingItemResult,
): void {
  summary.processedProducts++;
  if (result === 'unmapped') {
    summary.unmappedProducts++;
    return;
  }

  summary.ensuredProducts++;
}

export async function pollGrocyForMissingStock(
  options: PollGrocyForMissingStockOptions = {},
): Promise<GrocyMissingStockPollResult> {
  log.info('[Grocy→Mealie] Polling for missing stock...');

  const shoppingListId = await resolveShoppingListId();
  const summary = createEmptySummary();
  const lowStockSyncSkipped = !shoppingListId;

  try {
    const state = await getSyncState();
    const currentAmounts: Record<number, number> = {};
    if (shoppingListId) {
      const ensureAllPresent = options.ensureAllPresent ?? await resolveEnsureLowStockOnMealieList();
      const logUnmappedPresenceCheckProducts = options.logUnmappedPresenceCheckProducts ?? false;
      const syncSubProducts = await resolveSyncSubProducts();
      const volatile = await getVolatileStock();
      const missingProducts: GrocyMissingProduct[] = volatile.missing_products || [];
      const previousAmounts = state.grocyBelowMinStock;

      for (const mp of missingProducts) {
        currentAmounts[mp.id] = mp.amount_missing;
      }

      // Fetch all Mealie shopping list items once, to be reused across all adjustments
      const mealieShoppingItems = await fetchAllMealieShoppingItems(shoppingListId);
      let grocyProductsById = new Map<number, GrocyProductWithParent>();
      try {
        const grocyProducts = await getGrocyEntities('products');
        grocyProductsById = new Map(
          grocyProducts.map(product => [Number(product.id), product as GrocyProductWithParent]),
        );
      } catch (error) {
        log.warn(
          '[Grocy→Mealie] Could not fetch Grocy products for purchase-unit resolution; falling back to stored unit mappings:',
          error,
        );
      }

      // Build parent lookup from current products
      const parentByProductId = new Map<number, number>();
      if (syncSubProducts) {
        for (const [id, product] of grocyProductsById) {
          if (product.parent_product_id) {
            parentByProductId.set(id, Number(product.parent_product_id));
          }
        }
        if (!subProductCapabilityChecked && grocyProductsById.size > 0) {
          subProductCapabilityChecked = true;
          if (parentByProductId.size === 0) {
            log.info('[Grocy→Mealie] parent_product_id not found in Grocy product data — sub-product sync has no effect');
          }
        }
      }

      // Build effective current map (keyed by resolved parent ID)
      const effectiveCurrentMap = new Map<number, EffectiveMissingEntry>();
      for (const mp of missingProducts) {
        const effectiveId = syncSubProducts ? (parentByProductId.get(mp.id) ?? mp.id) : mp.id;
        const isChild = effectiveId !== mp.id;
        const entry = effectiveCurrentMap.get(effectiveId);
        if (entry) {
          entry.amount_missing += mp.amount_missing;
          if (isChild) {
            entry.subProducts.push({ name: mp.name, grocyProductId: mp.id, amount: mp.amount_missing });
            log.info(`[Grocy→Mealie] Sub-product "${mp.name}" (ID ${mp.id}) → resolved to parent ID ${effectiveId}`);
          }
        } else {
          const effectiveName = isChild
            ? (grocyProductsById.get(effectiveId)?.name ?? `product #${effectiveId}`)
            : mp.name;
          effectiveCurrentMap.set(effectiveId, {
            effectiveId,
            effectiveName,
            amount_missing: mp.amount_missing,
            subProducts: isChild ? [{ name: mp.name, grocyProductId: mp.id, amount: mp.amount_missing }] : [],
          });
        }
      }

      // Build effective previous map using snapshot from last poll (avoids misattribution on re-parenting)
      const prevEffectiveParents = state.grocyEffectiveParentByOriginalId ?? {};
      const effectivePreviousMap = new Map<number, number>();
      for (const [origId, amount] of Object.entries(previousAmounts)) {
        const effectiveId = syncSubProducts
          ? (prevEffectiveParents[Number(origId)] ?? Number(origId))
          : Number(origId);
        effectivePreviousMap.set(effectiveId, (effectivePreviousMap.get(effectiveId) ?? 0) + amount);
      }

      // Log combined sub-product entries
      for (const entry of effectiveCurrentMap.values()) {
        if (entry.subProducts.length > 1) {
          const names = entry.subProducts.map(s => `${s.amount}× ${s.name}`).join(', ');
          log.info(`[Grocy→Mealie] ${entry.subProducts.length} sub-products of parent ID ${entry.effectiveId} combined into 1 list item: "${names}"`);
        }
      }

      // 1. Newly missing → add to Mealie
      const newlyMissing = [...effectiveCurrentMap.values()].filter(
        e => !effectivePreviousMap.has(e.effectiveId),
      );
      let newlyAdded = 0;
      for (const entry of newlyMissing) {
        const result = await adjustMealieShoppingItem(
          entry.effectiveId,
          entry.amount_missing,
          shoppingListId,
          mealieShoppingItems,
          grocyProductsById,
          {
            grocyProductName: entry.effectiveName,
            ...(syncSubProducts ? { subProducts: entry.subProducts } : {}),
          },
        );
        recordMissingStockResult(summary, result);
        if (result === 'ensured') newlyAdded++;
      }

      // 2. Still missing, amount changed → adjust by delta
      const amountChanged = [...effectiveCurrentMap.values()].filter(
        e => effectivePreviousMap.has(e.effectiveId) && effectivePreviousMap.get(e.effectiveId) !== e.amount_missing,
      );
      let adjusted = 0;
      for (const entry of amountChanged) {
        const delta = entry.amount_missing - (effectivePreviousMap.get(entry.effectiveId) ?? 0);
        const result = await adjustMealieShoppingItem(
          entry.effectiveId,
          delta,
          shoppingListId,
          mealieShoppingItems,
          grocyProductsById,
          {
            grocyProductName: entry.effectiveName,
            createQuantityWhenMissing: ensureAllPresent ? entry.amount_missing : undefined,
            ...(syncSubProducts ? { subProducts: entry.subProducts } : {}),
          },
        );
        recordMissingStockResult(summary, result);
        if (result === 'ensured') adjusted++;
      }

      // 2b. Still missing, amount unchanged → optionally recreate if removed from Mealie
      const unchangedMissing = ensureAllPresent
        ? [...effectiveCurrentMap.values()].filter(
            e => effectivePreviousMap.has(e.effectiveId) && effectivePreviousMap.get(e.effectiveId) === e.amount_missing,
          )
        : [];
      let unmappedPresenceCheckProducts = 0;
      for (const entry of unchangedMissing) {
        const result = await adjustMealieShoppingItem(
          entry.effectiveId,
          0,
          shoppingListId,
          mealieShoppingItems,
          grocyProductsById,
          {
            grocyProductName: entry.effectiveName,
            createQuantityWhenMissing: entry.amount_missing,
            logWhenMappingMissing: logUnmappedPresenceCheckProducts,
            ...(syncSubProducts ? { subProducts: entry.subProducts } : {}),
          },
        );
        recordMissingStockResult(summary, result);
        if (result === 'unmapped') {
          unmappedPresenceCheckProducts++;
        }
      }

      // 3. No longer missing → subtract Grocy's contribution
      const noLongerMissing = [...effectivePreviousMap.keys()].filter(
        id => !effectiveCurrentMap.has(id),
      );
      let restocked = 0;
      let skippedSyncRestocked = 0;
      for (const effectiveId of noLongerMissing) {
        if (effectiveId in state.syncRestockedProducts) {
          const name = await resolveGrocyProductName(effectiveId);
          log.info(`[Grocy→Mealie] Skipping removal for "${name}" — restocked by sync, not manually`);
          delete state.syncRestockedProducts[effectiveId];
          skippedSyncRestocked++;
          continue;
        }
        const prevAmount = effectivePreviousMap.get(effectiveId) ?? 0;
        const result = await adjustMealieShoppingItem(
          effectiveId,
          -prevAmount,
          shoppingListId,
          mealieShoppingItems,
          grocyProductsById,
          // Clear managed sub-product note/extras if item stays on list with remaining user qty
          syncSubProducts ? { subProducts: [] } : {},
        );
        if (result === 'ensured') restocked++;
      }

      if (newlyMissing.length > 0) {
        log.info(`[Grocy→Mealie] ${newlyAdded}/${newlyMissing.length} newly missing product(s) added to shopping list`);
      }
      if (amountChanged.length > 0) {
        log.info(`[Grocy→Mealie] ${adjusted}/${amountChanged.length} product(s) quantity adjusted`);
      }
      if (ensureAllPresent && unchangedMissing.length > 0) {
        const unmappedSuffix = unmappedPresenceCheckProducts > 0
          ? ` (${unmappedPresenceCheckProducts} unmapped)`
          : '';
        log.info(`[Grocy→Mealie] Presence check completed for ${unchangedMissing.length} still-missing product(s)${unmappedSuffix}`);
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

      // Save snapshot of child→parent for next poll
      state.grocyEffectiveParentByOriginalId = syncSubProducts
        ? Object.fromEntries(parentByProductId)
        : {};
    } else {
      log.warn('[Grocy→Mealie] No shopping list configured — skipping low-stock sync');
    }

    const inPossessionResult = await syncMealieInPossessionFromGrocy(state);
    if (inPossessionResult.status === 'error') {
      log.error('[Grocy→Mealie] "In possession" sync failed after low-stock processing completed');
    }

    state.syncRestockedProducts = {};
    state.grocyBelowMinStock = currentAmounts;
    state.lastGrocyPoll = new Date();
    await saveSyncState(state);

    const partial = summary.unmappedProducts > 0 || inPossessionResult.status === 'error';

    if (partial) {
      return {
        status: 'partial',
        reason: lowStockSyncSkipped ? 'no-shopping-list' : undefined,
        inPossessionStatus: inPossessionResult.status,
        inPossessionSummary: inPossessionResult.summary,
        summary,
      };
    }

    if (lowStockSyncSkipped) {
      return {
        status: 'skipped',
        reason: 'no-shopping-list',
        inPossessionStatus: inPossessionResult.status,
        inPossessionSummary: inPossessionResult.summary,
        summary,
      };
    }

    return {
      status: 'ok',
      inPossessionStatus: inPossessionResult.status,
      inPossessionSummary: inPossessionResult.summary,
      summary,
    };
  } catch (error) {
    log.error('[Grocy→Mealie] Error polling Grocy:', error);
    return {
      status: 'error',
      summary,
    };
  }
}

export async function ensureGrocyMissingStockOnMealie(
  options: Pick<PollGrocyForMissingStockOptions, 'logUnmappedPresenceCheckProducts'> = {},
): Promise<GrocyMissingStockPollResult> {
  return pollGrocyForMissingStock({
    ensureAllPresent: true,
    logUnmappedPresenceCheckProducts: options.logUnmappedPresenceCheckProducts,
  });
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
  grocyProductsById: Map<number, GrocyProductWithParent>,
  options: AdjustMealieShoppingItemOptions = {},
): Promise<AdjustMealieShoppingItemResult> {
  const mappings = await db.select()
    .from(productMappings)
    .where(eq(productMappings.grocyProductId, grocyProductId))
    .limit(1);

  if (mappings.length === 0) {
    const productNameSuffix = options.grocyProductName ? ` ("${options.grocyProductName}")` : '';
    if (options.logWhenMappingMissing ?? true) {
      log.warn(`[Grocy→Mealie] No mapping found for Grocy product ID ${grocyProductId}${productNameSuffix}, skipping`);
    }
    return 'unmapped';
  }

  const mapping = mappings[0];

  const unitId = await resolveMappedMealieUnitId(mapping.grocyProductId, mapping.unitMappingId, grocyProductsById);

  // Find existing unchecked item on the list using pre-fetched items
  const existingItem = mealieShoppingItems.find(item =>
    item.foodId === mapping.mealieFoodId && !item.checked
  );

  // Compute note/extras for sub-product tracking using the correct existing item
  let subProductNote: string | null | undefined;
  let subProductExtras: Record<string, unknown> | undefined;
  if (options.subProducts !== undefined) {
    const newSegment = options.subProducts.length > 0
      ? buildSubProductNote(options.subProducts)
      : null;
    const prevSegment = existingItem ? ((existingItem.extras?.[GMS_NOTE_KEY] as string) ?? null) : null;
    subProductNote = existingItem
      ? replaceSubProductNote(existingItem.note, prevSegment, newSegment)
      : newSegment;
    subProductExtras = {
      ...(existingItem?.extras ?? {}),
      [GMS_NAMES_KEY]: JSON.stringify(options.subProducts.map(s => s.name)),
      [GMS_NOTE_KEY]: newSegment ?? '',
      [GMS_ITEMS_KEY]: JSON.stringify(options.subProducts),
    };
  }

  if (existingItem) {
    if (delta === 0) {
      // Metadata-only update: refresh note/extras only when sub-product composition actually changed
      if (subProductExtras !== undefined) {
        const currentNote = existingItem.note ?? null;
        const currentItems = (existingItem.extras?.[GMS_ITEMS_KEY] as string) ?? '[]';
        const currentNoteKey = (existingItem.extras?.[GMS_NOTE_KEY] as string) ?? '';
        const newItems = subProductExtras[GMS_ITEMS_KEY] as string;
        const newNoteKey = (subProductExtras[GMS_NOTE_KEY] as string) ?? '';
        const metadataChanged =
          (subProductNote ?? null) !== currentNote ||
          newItems !== currentItems ||
          newNoteKey !== currentNoteKey;
        if (metadataChanged) {
          await HouseholdsShoppingListItemsService.updateOneApiHouseholdsShoppingItemsItemIdPut(
            existingItem.id,
            {
              shoppingListId: shoppingListId,
              quantity: existingItem.quantity || 0,
              foodId: mapping.mealieFoodId,
              unitId: unitId || undefined,
              note: subProductNote ?? null,
              extras: subProductExtras,
            }
          );
        }
      }
      return 'ensured';
    }

    const currentQty = existingItem.quantity || 0;
    const newQty = currentQty + delta;

    if (newQty <= 0) {
      // Remove item entirely
      await HouseholdsShoppingListItemsService.deleteOneApiHouseholdsShoppingItemsItemIdDelete(existingItem.id);
      log.info(`[Grocy→Mealie] Removed "${mapping.mealieFoodName}" from list (qty ${currentQty} → 0)`);
    } else {
      // Update quantity (and note/extras if sub-products are tracked)
      log.info(`[Grocy→Mealie] Adjusting "${mapping.mealieFoodName}" quantity: ${currentQty} → ${newQty} (delta: ${delta > 0 ? '+' : ''}${delta})`);
      await HouseholdsShoppingListItemsService.updateOneApiHouseholdsShoppingItemsItemIdPut(
        existingItem.id,
        {
          shoppingListId: shoppingListId,
          quantity: newQty,
          foodId: mapping.mealieFoodId,
          unitId: unitId || undefined,
          ...(subProductNote !== undefined ? { note: subProductNote } : {}),
          ...(subProductExtras !== undefined ? { extras: subProductExtras } : {}),
        }
      );
    }
  } else {
    const createQuantity = options.createQuantityWhenMissing ?? delta;
    if (createQuantity <= 0) {
      return 'ensured';
    }

    // No existing item, create new one
    log.info(`[Grocy→Mealie] Adding "${mapping.mealieFoodName}" to Mealie shopping list (qty: ${createQuantity})`);
    await HouseholdsShoppingListItemsService.createOneApiHouseholdsShoppingItemsPost({
      shoppingListId: shoppingListId,
      foodId: mapping.mealieFoodId,
      unitId: unitId || undefined,
      quantity: createQuantity,
      checked: false,
      ...(subProductNote !== undefined ? { note: subProductNote } : {}),
      ...(subProductExtras !== undefined ? { extras: subProductExtras } : {}),
    });
  }
  return 'ensured';
}

async function resolveMappedMealieUnitId(
  grocyProductId: number,
  fallbackUnitMappingId: string | null,
  grocyProductsById: Map<number, GrocyProductWithParent>,
): Promise<string | undefined> {
  const grocyPurchaseUnitId = Number(grocyProductsById.get(grocyProductId)?.qu_id_purchase ?? 0);
  if (grocyPurchaseUnitId > 0) {
    const units = await db.select()
      .from(unitMappings)
      .where(eq(unitMappings.grocyUnitId, grocyPurchaseUnitId))
      .limit(1);
    if (units.length > 0) {
      return units[0].mealieUnitId || undefined;
    }
  }

  if (fallbackUnitMappingId) {
    const units = await db.select()
      .from(unitMappings)
      .where(eq(unitMappings.id, fallbackUnitMappingId))
      .limit(1);
    if (units.length > 0) {
      return units[0].mealieUnitId || undefined;
    }
  }

  return undefined;
}

async function resolveGrocyProductName(grocyProductId: number): Promise<string> {
  const mappings = await db.select()
    .from(productMappings)
    .where(eq(productMappings.grocyProductId, grocyProductId))
    .limit(1);
  return mappings.length > 0 ? mappings[0].grocyProductName : `product #${grocyProductId}`;
}

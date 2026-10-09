import { db } from '../db';
import { productMappings, unitMappings } from '../db/schema';
import { getGrocyEntities, getVolatileStock, getCurrentStock } from '../grocy/types';
import type { GrocyMissingProduct, GrocyProductWithParent } from '../grocy/types';
import { HouseholdsShoppingListItemsService } from '../mealie';
import type { MealieShoppingItem } from '../mealie/types';
import { log } from '../logger';
import {
  resolveEnsureLowStockOnMealieList,
  resolveShoppingListId,
  resolveSyncSubProducts,
  resolveSyncParentOwnStock,
} from '../settings';
import { syncMealieInPossessionFromGrocy, type MealieInPossessionSyncResult } from './mealie-in-possession';
import { getSyncState, saveSyncState, saveSyncStateConsumingRestocks } from './state';
import { loadLowStockAdjustments, type LowStockAdjustments } from '../shop/low-stock-accounting';
import { isCountUnitName } from '../shop/units';
import { fetchAllMealieShoppingItems } from './helpers';
import { eq } from 'drizzle-orm';
import type { HistoryEventInput } from '../history-store';
import { activityEvent, describeSyncError } from './activity';
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
  history?: { events: HistoryEventInput[]; recordedErrors: Set<unknown>; reason: string; deficit?: number };
  createQuantityWhenMissing?: number;
  /** Full current shortage (stock units); used when a positive delta finds no row of the sync's own. */
  fullShortage?: number;
  grocyProductName?: string;
  logWhenMappingMissing?: boolean;
  /** When set, the function computes and writes note/extras for sub-product tracking. */
  subProducts?: SubProductItem[];
  /** Grocy quantity unit names, loaded at most once per poll. Required so no caller can skip the count-unit rule. */
  unitNames: () => Promise<Map<number, string>>;
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
  inPossessionError?: string;
  inPossessionSummary?: MealieInPossessionSyncResult['summary'];
  summary: GrocyMissingStockSyncSummary;
  events?: HistoryEventInput[];
}

/** `skipped`: the shortage could not be written with an unambiguous unit. */
type AdjustMealieShoppingItemResult = 'ensured' | 'unmapped' | 'skipped';

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
  if (result === 'skipped') return;

  summary.ensuredProducts++;
}

export async function pollGrocyForMissingStock(
  options: PollGrocyForMissingStockOptions = {},
): Promise<GrocyMissingStockPollResult> {
  log.info('[Grocy→Mealie] Polling for missing stock...');

  const shoppingListId = await resolveShoppingListId();
  const summary = createEmptySummary();
  const events: HistoryEventInput[] = [];
  const recordedErrors = new Set<unknown>();
  const lowStockSyncSkipped = !shoppingListId;

  try {
    const state = await getSyncState();
    const currentAmounts: Record<number, number> = {};
    // Receipt restocks accounted for in this poll; consumed atomically with the snapshot.
    const consumedRestockIds: string[] = [];
    let lowStockAdjustments: LowStockAdjustments = { accounted: [], frozenProductIds: new Set() };
    try {
      lowStockAdjustments = loadLowStockAdjustments();
    } catch (error) {
      log.warn('[Grocy→Mealie] Could not load shop booking adjustments:', error);
    }
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
      let unitNamesPromise: Promise<Map<number, string>> | null = null;
      const unitNames = () => {
        unitNamesPromise ??= getGrocyEntities('quantity_units')
          .then(units => new Map(units.map(unit => [Number(unit.id), unit.name ?? ''])));
        return unitNamesPromise;
      };
      // Rows are labelled with each product's stock unit; without the products the
      // poll cannot write unambiguous rows and is retried as a whole next time.
      let grocyProductsById: Map<number, GrocyProductWithParent>;
      try {
        const grocyProducts = await getGrocyEntities('products');
        grocyProductsById = new Map(
          grocyProducts.map(product => [Number(product.id), product as GrocyProductWithParent]),
        );
      } catch (error) {
        log.warn('[Grocy→Mealie] Could not fetch Grocy products; skipping this low-stock poll:', error);
        throw error;
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

      // Build effective previous map using snapshot from last poll (avoids misattribution on re-parenting)
      const prevEffectiveParents = state.grocyEffectiveParentByOriginalId ?? {};

      // Build effective current map (keyed by resolved parent ID)
      const effectiveCurrentMap = new Map<number, EffectiveMissingEntry>();
      for (const mp of missingProducts) {
        const effectiveId = syncSubProducts ? (parentByProductId.get(mp.id) ?? mp.id) : mp.id;
        const isChild = effectiveId !== mp.id;
        const entry = effectiveCurrentMap.get(effectiveId);
        if (entry) {
          entry.amount_missing += mp.amount_missing;
          if (isChild) {
            // If the entry was created for the parent product itself (no sub-products yet),
            // retroactively add the parent's own contribution before adding this sub-product.
            if (entry.subProducts.length === 0) {
              const parentOwnAmount = entry.amount_missing - mp.amount_missing;
              if (parentOwnAmount > 0) {
                const parentProduct = grocyProductsById.get(effectiveId);
                entry.subProducts.push({ name: parentProduct?.name ?? entry.effectiveName, grocyProductId: effectiveId, amount: parentOwnAmount });
              }
            }
            entry.subProducts.push({ name: mp.name, grocyProductId: mp.id, amount: mp.amount_missing });
            if (!(mp.id in previousAmounts) || prevEffectiveParents[mp.id] !== effectiveId) {
              log.info(`[Grocy→Mealie] Sub-product "${mp.name}" → resolved to parent "${grocyProductsById.get(effectiveId)?.name ?? `#${effectiveId}`}"`);
            }
          } else if (entry.subProducts.length > 0) {
            // Sub-product was processed before the parent: add the parent's own contribution now.
            entry.subProducts.push({ name: mp.name, grocyProductId: mp.id, amount: mp.amount_missing });
          }
        } else {
          const effectiveName = isChild
            ? (grocyProductsById.get(effectiveId)?.name ?? `product #${effectiveId}`)
            : mp.name;
          if (isChild && (!(mp.id in previousAmounts) || prevEffectiveParents[mp.id] !== effectiveId)) {
            log.info(`[Grocy→Mealie] Sub-product "${mp.name}" → resolved to parent "${grocyProductsById.get(effectiveId)?.name ?? `#${effectiveId}`}"`);
          }
          effectiveCurrentMap.set(effectiveId, {
            effectiveId,
            effectiveName,
            amount_missing: mp.amount_missing,
            subProducts: isChild ? [{ name: mp.name, grocyProductId: mp.id, amount: mp.amount_missing }] : [],
          });
        }
      }
      // Parent own-stock check: detect when a parent product's own inventory falls below
      // its minimum even though Grocy's aggregate stock (own + children) is still fine.
      // Only runs when both syncSubProducts and syncParentOwnStock are enabled.
      const syncParentOwnStock = syncSubProducts && await resolveSyncParentOwnStock();
      const parentOwnStockCurrentDeficit = new Map<number, number>();
      let parentOwnStockCheckFailed = false;
      if (syncParentOwnStock && parentByProductId.size > 0) {
        try {
          const currentStock = await getCurrentStock();
          const ownStockMap = new Map<number, number>();
          for (const s of currentStock) {
            if (s.product_id != null) {
              ownStockMap.set(Number(s.product_id), s.amount ?? 0);
            }
          }
          const parentIds = new Set(parentByProductId.values());
          for (const parentId of parentIds) {
            // Skip parents that Grocy already reports as missing (aggregate already below min).
            // Their deficit is tracked via the normal missing_products path.
            if (parentId in currentAmounts) continue;
            const parent = grocyProductsById.get(parentId);
            if (!parent) continue;
            const minStock = Number(parent.min_stock_amount ?? 0);
            if (minStock <= 0) continue;
            const ownStock = ownStockMap.get(parentId) ?? 0;
            if (ownStock >= minStock) continue;
            const deficit = minStock - ownStock;
            parentOwnStockCurrentDeficit.set(parentId, deficit);
            const existing = effectiveCurrentMap.get(parentId);
            if (existing) {
              existing.amount_missing += deficit;
              existing.subProducts.push({ name: parent.name ?? `product #${parentId}`, grocyProductId: parentId, amount: deficit });
            } else {
              effectiveCurrentMap.set(parentId, {
                effectiveId: parentId,
                effectiveName: parent.name ?? `product #${parentId}`,
                amount_missing: deficit,
                subProducts: [],
              });
            }
          }
        } catch (error) {
          parentOwnStockCheckFailed = true;
          log.warn('[Grocy→Mealie] Could not check parent product own stock:', error);
        }
      }

      const effectivePreviousMap = new Map<number, number>();
      for (const [origId, amount] of Object.entries(previousAmounts)) {
        const effectiveId = syncSubProducts
          ? (prevEffectiveParents[Number(origId)] ?? Number(origId))
          : Number(origId);
        effectivePreviousMap.set(effectiveId, (effectivePreviousMap.get(effectiveId) ?? 0) + amount);
      }
      // Inject previous parent own-stock deficits so the delta logic sees the full picture.
      // Skip on failure: injecting stale data without current data would make items look
      // "no longer missing" and trigger incorrect removals from the shopping list.
      if (!parentOwnStockCheckFailed) {
        for (const [parentId, deficit] of Object.entries(state.grocyParentOwnStockDeficit ?? {})) {
          const id = Number(parentId);
          effectivePreviousMap.set(id, (effectivePreviousMap.get(id) ?? 0) + deficit);
        }
      }
      // Incorporate amounts skipped in the previous poll (syncRestockedProducts guard), then
      // reset so the current poll can record fresh skips. This prevents stale item quantities
      // from appearing as a clean slate on the next poll after a restock-skip cycle.
      for (const [productId, amount] of Object.entries(state.grocySkippedRestockAmounts)) {
        const id = Number(productId);
        effectivePreviousMap.set(id, (effectivePreviousMap.get(id) ?? 0) + amount);
      }
      state.grocySkippedRestockAmounts = {};

      // Purchases booked from receipts already reduced the Mealie list. Subtract them
      // from the previous shortage so this poll does not reduce the list a second
      // time, while unrelated stock changes in the same interval still produce deltas.
      // Products with a booking of unknown outcome are frozen until it is settled.
      const effectiveIdOf = (productId: number) => (syncSubProducts ? (parentByProductId.get(productId) ?? productId) : productId);
      const frozenEffectiveIds = new Set([...lowStockAdjustments.frozenProductIds].map(effectiveIdOf));
      const accountedByEffective = new Map<number, number>();
      for (const restock of lowStockAdjustments.accounted) {
        const effectiveId = effectiveIdOf(restock.grocyProductId);
        if (frozenEffectiveIds.has(effectiveId)) continue;
        accountedByEffective.set(effectiveId, (accountedByEffective.get(effectiveId) ?? 0) + restock.stockAmount);
        consumedRestockIds.push(restock.effectId);
      }
      for (const [effectiveId, accounted] of accountedByEffective) {
        const previous = effectivePreviousMap.get(effectiveId);
        if (previous === undefined) continue;
        effectivePreviousMap.set(effectiveId, previous - Math.min(accounted, previous));
      }
      const notFrozen = (effectiveId: number) => !frozenEffectiveIds.has(effectiveId);

      // 1. Newly missing → add to Mealie
      const newlyMissing = [...effectiveCurrentMap.values()].filter(
        e => !effectivePreviousMap.has(e.effectiveId) && notFrozen(e.effectiveId),
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
            unitNames,
            history: { events, recordedErrors, reason: `Grocy stock is below the minimum; ${entry.amount_missing} missing.`, deficit: entry.amount_missing },
            ...(syncSubProducts ? { subProducts: entry.subProducts } : {}),
          },
        );
        recordMissingStockResult(summary, result);
        if (result === 'ensured') newlyAdded++;
      }

      // 2. Still missing, amount changed → adjust by delta
      const amountChanged = [...effectiveCurrentMap.values()].filter(
        e => effectivePreviousMap.has(e.effectiveId) && effectivePreviousMap.get(e.effectiveId) !== e.amount_missing && notFrozen(e.effectiveId),
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
            unitNames,
            history: { events, recordedErrors, reason: `Grocy's stock shortage changed from ${effectivePreviousMap.get(entry.effectiveId)} to ${entry.amount_missing}.`, deficit: entry.amount_missing },
            createQuantityWhenMissing: ensureAllPresent ? entry.amount_missing : undefined,
            fullShortage: entry.amount_missing,
            ...(syncSubProducts ? { subProducts: entry.subProducts } : {}),
          },
        );
        recordMissingStockResult(summary, result);
        if (result === 'ensured') adjusted++;
      }

      // 2b. Still missing, amount unchanged → optionally recreate if removed from Mealie
      const unchangedMissing = ensureAllPresent
        ? [...effectiveCurrentMap.values()].filter(
            e => effectivePreviousMap.has(e.effectiveId) && effectivePreviousMap.get(e.effectiveId) === e.amount_missing && notFrozen(e.effectiveId),
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
            unitNames,
            history: { events, recordedErrors, reason: `Grocy stock is still below the minimum; ensuring ${entry.amount_missing} missing are on the Mealie list.`, deficit: entry.amount_missing },
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
        id => !effectiveCurrentMap.has(id) && notFrozen(id),
      );
      let restocked = 0;
      let skippedSyncRestocked = 0;
      for (const effectiveId of noLongerMissing) {
        if (effectiveId in state.syncRestockedProducts) {
          const name = await resolveGrocyProductName(effectiveId);
          log.info(`[Grocy→Mealie] Skipping removal for "${name}" — restocked by sync, not manually`);
          delete state.syncRestockedProducts[effectiveId];
          // Save the skipped amount so the next poll can account for this item's stale quantity.
          const skippedAmount = effectivePreviousMap.get(effectiveId) ?? 0;
          if (skippedAmount > 0) {
            state.grocySkippedRestockAmounts[effectiveId] = skippedAmount;
          }
          skippedSyncRestocked++;
          continue;
        }
        const prevAmount = effectivePreviousMap.get(effectiveId) ?? 0;
        // A receipt booking already accounted for the whole previous shortage.
        if (prevAmount <= 0) continue;
        const result = await adjustMealieShoppingItem(
          effectiveId,
          -prevAmount,
          shoppingListId,
          mealieShoppingItems,
          grocyProductsById,
          // Clear managed sub-product note/extras if item stays on list with remaining user qty
          {
            ...(syncSubProducts ? { subProducts: [] } : {}),
            unitNames,
            history: { events, recordedErrors, reason: 'Grocy stock reached its minimum again; removing its previous shopping list contribution.', deficit: 0 },
          },
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

      // Frozen products keep their previous snapshot until the booking outcome is known.
      if (frozenEffectiveIds.size > 0) {
        for (const id of Object.keys(currentAmounts).map(Number)) {
          if (frozenEffectiveIds.has(effectiveIdOf(id))) delete currentAmounts[id];
        }
        for (const [origId, amount] of Object.entries(previousAmounts)) {
          const effectiveId = syncSubProducts ? (prevEffectiveParents[Number(origId)] ?? Number(origId)) : Number(origId);
          if (frozenEffectiveIds.has(effectiveId)) currentAmounts[Number(origId)] = amount;
        }
      }

      // Save snapshot of child→parent and parent own-stock deficits for next poll
      state.grocyEffectiveParentByOriginalId = syncSubProducts
        ? Object.fromEntries(parentByProductId)
        : {};
      state.grocyParentOwnStockDeficit = !syncParentOwnStock
        ? {}
        : parentOwnStockCheckFailed
          ? state.grocyParentOwnStockDeficit
          : Object.fromEntries(parentOwnStockCurrentDeficit);
    } else {
      log.warn('[Grocy→Mealie] No shopping list configured — skipping low-stock sync');
    }

    const inPossessionResult = await syncMealieInPossessionFromGrocy(state);
    events.push(...(inPossessionResult.events ?? []));
    if (inPossessionResult.status === 'error') {
      log.error(
        `[Grocy→Mealie] "In possession" sync failed after low-stock processing completed${inPossessionResult.error ? `: ${inPossessionResult.error}` : ''}`,
      );
    }

    state.syncRestockedProducts = {};
    state.grocyBelowMinStock = currentAmounts;
    state.lastGrocyPoll = new Date();
    if (consumedRestockIds.length > 0) {
      await saveSyncStateConsumingRestocks(state, consumedRestockIds);
    } else {
      await saveSyncState(state);
    }

    // Unmapped low-stock products are a backlog, not a failure: they are a normal
    // steady state (a catalogue can carry hundreds), and counting them as 'partial'
    // put every scheduler cycle into /fail on Healthchecks, drowning out real
    // breakage. The count stays in the summary, the run message and the history
    // event; only the status is reserved for things that actually went wrong.
    const partial = inPossessionResult.status === 'error';

    if (partial) {
      return {
        status: 'partial',
        reason: lowStockSyncSkipped ? 'no-shopping-list' : undefined,
        inPossessionStatus: inPossessionResult.status,
        inPossessionError: inPossessionResult.error,
        inPossessionSummary: inPossessionResult.summary,
        summary,
        events,
      };
    }

    if (lowStockSyncSkipped) {
      return {
        status: 'skipped',
        reason: 'no-shopping-list',
        inPossessionStatus: inPossessionResult.status,
        inPossessionError: inPossessionResult.error,
        inPossessionSummary: inPossessionResult.summary,
        summary,
        events,
      };
    }

    return {
      status: 'ok',
      inPossessionStatus: inPossessionResult.status,
      inPossessionError: inPossessionResult.error,
      inPossessionSummary: inPossessionResult.summary,
      summary,
      events,
    };
  } catch (error) {
    log.error('[Grocy→Mealie] Error polling Grocy:', error);
    if (!recordedErrors.has(error)) {
      events.push(activityEvent({
        level: 'error', source: 'Grocy', target: 'Mealie',
        message: `Grocy to Mealie sync failed: ${describeSyncError(error)}`,
        reason: 'Could not complete the low-stock sync.', details: { error: describeSyncError(error) },
      }));
    }
    return {
      status: 'error',
      summary,
      events,
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

function logCombinedSubProducts(parentName: string, subProducts: SubProductItem[] | undefined): void {
  if (!subProducts || subProducts.length <= 1) return;
  const names = subProducts.map(s => `${s.amount}× ${s.name}`).join(', ');
  log.info(`[Grocy→Mealie] ${subProducts.length} sub-products of "${parentName}" combined into 1 list item: "${names}"`);
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
  options: AdjustMealieShoppingItemOptions,
): Promise<AdjustMealieShoppingItemResult> {
  try {
    return await applyMealieShoppingAdjustment(grocyProductId, delta, shoppingListId, mealieShoppingItems, grocyProductsById, options);
  } catch (error) {
    options.history?.events.push(activityEvent({
      level: 'error', source: 'Grocy', target: 'Mealie', productName: options.grocyProductName ?? grocyProductsById.get(grocyProductId)?.name,
      entityRef: `grocy:${grocyProductId}`, message: `Could not update the Mealie shopping list: ${describeSyncError(error)}`,
      reason: options.history.reason, details: { grocyProductId, delta, error: describeSyncError(error) },
    }));
    options.history?.recordedErrors.add(error);
    throw error;
  }
}

async function applyMealieShoppingAdjustment(
  grocyProductId: number,
  delta: number,
  shoppingListId: string,
  mealieShoppingItems: MealieShoppingItem[],
  grocyProductsById: Map<number, GrocyProductWithParent>,
  options: AdjustMealieShoppingItemOptions,
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
  const recordChange = (message: string, before: number | null, after: number | null, itemId?: string) => {
    options.history?.events.push(activityEvent({
      source: 'Grocy', target: 'Mealie', productName: mapping.grocyProductName,
      category: 'shopping', entityKind: 'shopping_item', entityRef: `grocy:${grocyProductId}`,
      message, reason: options.history.reason,
      details: { grocyProductId, grocyProductName: mapping.grocyProductName, mealieFoodId: mapping.mealieFoodId,
        mealieFoodName: mapping.mealieFoodName, shoppingListId, mealieItemId: itemId,
        before, after, deficit: options.history.deficit, subProducts: options.subProducts },
    }));
  };

  // Shortages are stock amounts, so rows are labelled with the stock unit and
  // the quantity is expressed in that Mealie unit.
  const label = await resolveStockUnitLabel(mapping.grocyProductId, grocyProductsById, options.unitNames);
  if (!label) {
    // Without a Mealie unit for a known stock unit, a row without a unit could be read
    // as a count of the purchase unit; writing it would invite a wrong booking on check-off.
    const productName = options.grocyProductName ?? mapping.grocyProductName;
    log.warn(`[Grocy→Mealie] Not writing "${productName}": its Grocy stock unit is unknown, or has no Mealie unit and does not count pieces`);
    if (delta !== 0 && options.history) {
      options.history.events.push(activityEvent({
        level: 'warning', source: 'Grocy', target: 'Mealie', productName, category: 'shopping', entityRef: `grocy:${grocyProductId}`,
        message: `Did not add "${productName}" to the Mealie shopping list: its Grocy stock unit is unknown or has no Mealie unit.`,
        reason: `${options.history.reason} Map the product's Grocy stock unit to a Mealie unit so the missing amount can be written unambiguously.`,
        details: { grocyProductId, mealieFoodId: mapping.mealieFoodId, deficit: options.history.deficit },
      }));
    }
    return 'skipped';
  }
  const unitId = label.unitId;
  const toLabelQuantity = (stockAmount: number) => label.factor === 1 ? stockAmount : Number((stockAmount / label.factor).toFixed(6));
  delta = toLabelQuantity(delta);

  // Only a row in the same unit without recipe references belongs to the sync:
  // its quantity means stock units whoever wrote it. Recipe rows ("400 g") and
  // rows in another unit are never changed, relabelled or removed.
  const existingItem = mealieShoppingItems.find(item =>
    item.foodId === mapping.mealieFoodId && !item.checked
    && (item.unitId || null) === (unitId ?? null)
    && (item.recipeReferences?.length ?? 0) === 0
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
          logCombinedSubProducts(options.grocyProductName ?? grocyProductsById.get(grocyProductId)?.name ?? `#${grocyProductId}`, options.subProducts);
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
          recordChange(`Updated sub-product details for "${mapping.mealieFoodName}" on the Mealie shopping list.`, existingItem.quantity ?? 0, existingItem.quantity ?? 0, existingItem.id);
        }
      }
      return 'ensured';
    }

    const currentQty = existingItem.quantity || 0;
    const newQty = currentQty + delta;

    if (newQty <= 0) {
      // Remove item entirely
      await HouseholdsShoppingListItemsService.deleteOneApiHouseholdsShoppingItemsItemIdDelete(existingItem.id);
      recordChange(`Removed "${mapping.mealieFoodName}" from the Mealie shopping list (${currentQty} → 0).`, currentQty, 0, existingItem.id);
      log.info(`[Grocy→Mealie] Removed "${mapping.mealieFoodName}" from list (qty ${currentQty} → 0)`);
    } else {
      // Update quantity (and note/extras if sub-products are tracked)
      logCombinedSubProducts(options.grocyProductName ?? grocyProductsById.get(grocyProductId)?.name ?? `#${grocyProductId}`, options.subProducts);
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
      recordChange(`Changed "${mapping.mealieFoodName}" on the Mealie shopping list: ${currentQty} → ${newQty}.`, currentQty, newQty, existingItem.id);
    }
  } else {
    // A positive change without a row of the sync's own (removed, or a legacy row
    // in another unit) recreates the full shortage instead of only the change.
    const createQuantity = options.createQuantityWhenMissing !== undefined
      ? toLabelQuantity(options.createQuantityWhenMissing)
      : delta > 0 && options.fullShortage !== undefined ? toLabelQuantity(options.fullShortage) : delta;
    if (createQuantity <= 0) {
      return 'ensured';
    }

    // No existing item, create new one
    logCombinedSubProducts(options.grocyProductName ?? grocyProductsById.get(grocyProductId)?.name ?? `#${grocyProductId}`, options.subProducts);
    log.info(`[Grocy→Mealie] Adding "${mapping.mealieFoodName}" to Mealie shopping list (qty: ${createQuantity})`);
    const created = await HouseholdsShoppingListItemsService.createOneApiHouseholdsShoppingItemsPost({
      shoppingListId: shoppingListId,
      foodId: mapping.mealieFoodId,
      unitId: unitId || undefined,
      quantity: createQuantity,
      checked: false,
      ...(subProductNote !== undefined ? { note: subProductNote } : {}),
      ...(subProductExtras !== undefined ? { extras: subProductExtras } : {}),
    });
    recordChange(`Added "${mapping.mealieFoodName}" to the Mealie shopping list (quantity ${createQuantity}).`, 0, createQuantity, created?.createdItems?.[0]?.id);
  }
  return 'ensured';
}

/**
 * The Mealie unit for a product's Grocy stock unit, and how many Grocy stock
 * units one of it holds. The purchase unit is never used, because the quantity
 * written is a stock amount. Without a valid mapping the row gets no unit, but
 * only where an empty unit means the stock unit (the rule check-off applies):
 * purchase and stock unit agree, or the stock unit counts pieces ("Stuk").
 * Returns null when no unambiguous label exists, including when the product or
 * its stock unit is unknown.
 */
async function resolveStockUnitLabel(
  grocyProductId: number,
  grocyProductsById: Map<number, GrocyProductWithParent>,
  unitNames?: () => Promise<Map<number, string>>,
): Promise<{ unitId: string | undefined; factor: number } | null> {
  const product = grocyProductsById.get(grocyProductId);
  const grocyStockUnitId = Number(product?.qu_id_stock ?? 0);
  if (!product || !(grocyStockUnitId > 0)) return null;
  const units = await db.select()
    .from(unitMappings)
    .where(eq(unitMappings.grocyUnitId, grocyStockUnitId))
    .limit(1);
  const factor = Number(units[0]?.conversionFactor ?? 1);
  if (units.length > 0 && units[0].mealieUnitId && Number.isFinite(factor) && factor > 0) {
    return { unitId: units[0].mealieUnitId, factor };
  }
  const grocyPurchaseUnitId = Number(product.qu_id_purchase ?? 0);
  if (!(grocyPurchaseUnitId > 0) || grocyPurchaseUnitId === grocyStockUnitId) {
    return { unitId: undefined, factor: 1 };
  }
  const names = unitNames ? await unitNames() : new Map<number, string>();
  return isCountUnitName(names.get(grocyStockUnitId)) ? { unitId: undefined, factor: 1 } : null;
}

async function resolveGrocyProductName(grocyProductId: number): Promise<string> {
  const mappings = await db.select()
    .from(productMappings)
    .where(eq(productMappings.grocyProductId, grocyProductId))
    .limit(1);
  return mappings.length > 0 ? mappings[0].grocyProductName : `product #${grocyProductId}`;
}

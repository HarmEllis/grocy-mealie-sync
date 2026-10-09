import { db } from '../db';
import { productMappings } from '../db/schema';
import { getGrocyEntities, deleteGrocyEntity, getProductDetails } from '../grocy/types';
import type { GrocyProductWithParent } from '../grocy/types';
import type { ShoppingListItemOut_Output } from '../mealie/client/models/ShoppingListItemOut_Output';
import { log } from '../logger';
import { resolveShoppingListId, resolveStockOnlyMinStock } from '../settings';
import { getSyncState, saveSyncState, type SyncStateData } from './state';
import { fetchAllMealieShoppingItems } from './helpers';
import { shoppingItemUnitId } from './shopping-item';
import { eq } from 'drizzle-orm';
import type { HistoryEventInput } from '../history-store';
import { activityEvent, describeSyncError } from './activity';
import {
  bookCheckStock,
  findOpenLifecycle,
  getLifecycleBookings,
  guardReceiptFulfillment,
  handleUncheckedItem,
  openCheckLifecycle,
  reconcileCheckLifecycles,
  retireLegacyCheckLifecycle,
  setLifecycleStatus,
  type LifecycleBooking,
} from '../shop/check-lifecycles';
import { loadUnitContext } from '../shop/context';
import type { CheckConversion } from '../shop/effect-runners';
import { CheckDeferredError, UncertainWriteError } from '../shop/ledger';
import { resolveCheckOffAmount, type CheckOffFailure, type UnitContext } from '../shop/units';
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
  /** Bookings whose outcome is unknown; they wait for verification or a user decision. */
  uncertainItems?: number;
}

/** The unit data needed to convert a checked row could not be loaded; the row is retried next poll. */
export class UnitContextUnavailableError extends Error {
  constructor(readonly cause: unknown) {
    super(`Unit conversion data is unavailable: ${describeSyncError(cause)}`);
    this.name = 'UnitContextUnavailableError';
  }
}

type UnitContextLoader = () => Promise<UnitContext>;

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
    // Loaded at most once per poll, and only when a checked row needs conversion.
    let unitContextPromise: Promise<UnitContext> | null = null;
    const getUnitContext: UnitContextLoader = () => {
      unitContextPromise ??= loadUnitContext(grocyProductsById.size > 0 ? [...grocyProductsById.values()] : undefined);
      return unitContextPromise;
    };
    const unitContextFailures: { itemId: string; name: string | undefined }[] = [];
    let unitContextError: unknown = null;
    const previousCheckedState = state.mealieCheckedItems;
    const newCheckedState: Record<string, boolean> = {};
    const isBootstrapPoll = state.lastMealiePoll === null;

    if (isBootstrapPoll) {
      log.info('[Mealie→Grocy] Initial poll detected — snapshotting current checked state without restocking');
    }

    // Verify uncertain bookings and pick up rows the user asked to retry.
    let retryRequested = new Set<string>();
    if (!isBootstrapPoll) {
      try {
        const lifecycleResult = await reconcileCheckLifecycles(new Set(items.map(item => item.id)));
        retryRequested = new Set(lifecycleResult.retryRequested);
        // Bookings verified late get the same bookkeeping as direct ones.
        const nowIso = new Date().toISOString();
        for (const productId of lifecycleResult.appliedProductIds) state.syncRestockedProducts[String(productId)] = nowIso;
        for (const itemId of lifecycleResult.completedItemIds) state.mealieItemsSyncedToGrocy[itemId] = nowIso;
      } catch (error) {
        log.warn('[Mealie→Grocy] Could not reconcile check lifecycles:', error);
      }
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
        if (wasChecked === true) {
          try {
            handleUncheckedItem(item.id);
          } catch (error) {
            log.warn(`[Mealie→Grocy] Could not close the check lifecycle of "${item.id}":`, error);
          }
        }
      }

      if (checked && (wasChecked !== true || retryRequested.has(item.id))) {
        try {
          const grocyProductId = await processCheckedItem(item, state, grocyProductsById, events, getUnitContext);
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
          if (err instanceof UnitContextUnavailableError) {
            // Nothing was booked and no lifecycle was started: retry the row next
            // poll, exactly like a failed booking, but report the cause once.
            unitContextError = err.cause;
            unitContextFailures.push({ itemId: item.id, name: item.food?.name ?? item.display ?? item.note ?? undefined });
            delete newCheckedState[item.id];
            delete state.mealieCheckedAt[item.id];
            continue;
          }
          if (err instanceof CheckDeferredError) {
            summary.uncertainItems = (summary.uncertainItems ?? 0) + 1;
            events.push(activityEvent({
              level: 'warning', source: 'Mealie', target: 'Grocy',
              productName: item.food?.name ?? item.display ?? item.note ?? undefined,
              entityRef: item.id, message: 'The checked item was not booked: a receipt already covers this shopping row.',
              reason: 'Decide on the Shopping page whether the check is an additional purchase.',
              details: { mealieItemId: item.id, effectIds: err.effectIds },
            }));
            continue;
          }
          if (err instanceof UncertainWriteError) {
            // Never retry a write that may already have happened. Keep the row
            // marked as processed; verification or the user resolves it.
            log.warn(`[Mealie→Grocy] Booking for item "${item.id}" has an unknown outcome; waiting for verification or review`);
            summary.uncertainItems = (summary.uncertainItems ?? 0) + 1;
            // Treat the booking as possibly applied for the low-stock guard: skipping one
            // removal is harmless, removing a row for a booking that did land is not.
            if (err.productId !== null) state.syncRestockedProducts[String(err.productId)] = new Date().toISOString();
            events.push(activityEvent({
              level: 'warning', source: 'Mealie', target: 'Grocy',
              productName: item.food?.name ?? item.display ?? item.note ?? undefined,
              entityRef: item.id, message: `Grocy stock booking has an unknown outcome: ${err.message}`,
              reason: 'Uncertain writes are never retried automatically. Review it on the Shopping page.',
              details: { mealieItemId: item.id, mealieFoodId: item.foodId, effectId: err.effectId },
            }));
            continue;
          }
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

    if (unitContextFailures.length > 0) {
      log.warn(`[Mealie→Grocy] Unit conversion data unavailable; ${unitContextFailures.length} checked item(s) will be retried:`, unitContextError);
      events.push(activityEvent({
        level: 'warning', source: 'Mealie', target: 'Grocy',
        message: `Could not load unit conversion data; ${unitContextFailures.length} checked item(s) will be retried on the next sync.`,
        reason: 'Checked items are only booked when their amount can be converted to the Grocy stock unit.',
        details: { items: unitContextFailures, error: describeSyncError(unitContextError) },
      }));
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
async function processCheckedItem(
  item: ShoppingListItemOut_Output,
  state: SyncStateData,
  grocyProductsById: Map<number, GrocyProductWithParent>,
  events: HistoryEventInput[],
  getUnitContext: UnitContextLoader,
): Promise<number | null> {
  // One lifecycle per observed check; reused when this row is retried.
  let lifecycle: { id: string } | null = null;
  try {
    const productId = await processCheckedItemWithLifecycle(item, state, grocyProductsById, events, getUnitContext, (grocyProductId) => {
      lifecycle = openCheckLifecycle(item, grocyProductId);
      return lifecycle;
    });
    if (lifecycle) {
      const lifecycleId = (lifecycle as { id: string }).id;
      // A row that is not fulfilled can still hold applied bookings (sub-products);
      // its lifecycle stays completed so receipts credit those bookings.
      const booked = productId !== null || getLifecycleBookings(lifecycleId).some(booking => booking.status === 'applied');
      setLifecycleStatus(lifecycleId, booked ? 'completed' : 'skipped');
    }
    return productId;
  } catch (error) {
    if (lifecycle) {
      const blocked = error instanceof UncertainWriteError || error instanceof CheckDeferredError;
      setLifecycleStatus((lifecycle as { id: string }).id, blocked ? 'blocked' : 'failed');
    }
    throw error;
  }
}

async function processCheckedItemWithLifecycle(
  item: ShoppingListItemOut_Output,
  state: SyncStateData,
  grocyProductsById: Map<number, GrocyProductWithParent>,
  events: HistoryEventInput[],
  getUnitContext: UnitContextLoader,
  startLifecycle: (grocyProductId: number | null) => { id: string },
): Promise<number | null> {
  const foodId = item.foodId;
  if (!foodId) {
    // Ad-hoc item without mapped food — skip gracefully (Scenario 11)
    log.info(`[Mealie→Grocy] Skipping unmapped item "${item.note || item.display || item.id}" (no foodId)`);
    return null;
  }

  const subItems = parseSubProductItems(item);

  // Normal rows book one product. A retry re-uses the booking already planned for
  // this check (product, amount and label), even if the mapping changed or was
  // removed meanwhile. Unbooked bookings from before unit conversion are replaced.
  let priorBooking: LifecycleBooking | null = null;
  if (!subItems) {
    const retired = retireLegacyCheckLifecycle(item.id);
    if (retired.length > 0) {
      const retiredName = retired[0].label ?? item.food?.name ?? item.display ?? foodId;
      log.info(`[Mealie→Grocy] Cancelled ${retired.length} unbooked pre-conversion booking(s) for "${retiredName}"; booking again with conversion`);
      events.push(activityEvent({
        source: 'Mealie', target: 'Grocy', productName: retiredName, entityRef: item.id,
        message: `Replaced an unbooked earlier booking for "${retiredName}" with a unit-converted one.`,
        reason: 'Bookings from before unit conversion may hold recipe amounts (such as 400 for 400 g); none of them reached Grocy.',
        details: { mealieItemId: item.id, cancelled: retired.map(booking => ({ effectId: booking.effectId, productId: booking.productId, amount: booking.amount })) },
      }));
    }
    const open = findOpenLifecycle(item.id);
    priorBooking = open ? getLifecycleBookings(open.id)[0] ?? null : null;
  }

  // Look up product mapping
  const mappings = await db.select()
    .from(productMappings)
    .where(eq(productMappings.mealieFoodId, foodId))
    .limit(1);

  if (mappings.length === 0 && !priorBooking) {
    log.warn(`[Mealie→Grocy] No mapping found for Mealie food ${foodId}, skipping`);
    events.push(activityEvent({
      level: 'warning', source: 'Mealie', target: 'Grocy', productName: item.food?.name ?? item.display ?? undefined,
      entityRef: item.id, message: `Could not restock "${item.food?.name ?? item.display ?? foodId}" in Grocy.`,
      reason: 'The checked Mealie item has no linked Grocy product.', details: { mealieItemId: item.id, mealieFoodId: foodId },
    }));
    return null;
  }

  // The product this check books: the planned booking's on a retry, else the mapping's.
  const currentMapping = mappings[0] as typeof mappings[number] | undefined;
  const mapping: { grocyProductId: number; grocyProductName: string; mealieFoodName: string } = priorBooking
    ? {
      grocyProductId: priorBooking.productId,
      grocyProductName: priorBooking.label ?? currentMapping?.grocyProductName ?? `#${priorBooking.productId}`,
      mealieFoodName: currentMapping?.mealieFoodName ?? item.food?.name ?? foodId,
    }
    : currentMapping!;

  // Only a first booking converts the row, so the unit data is loaded before any
  // lifecycle exists; a failed load leaves nothing behind to clean up.
  let unitContext: UnitContext | null = null;
  if (!subItems && !priorBooking) {
    try {
      unitContext = await getUnitContext();
    } catch (error) {
      throw new UnitContextUnavailableError(error);
    }
  }

  const lifecycle = startLifecycle(mapping.grocyProductId);
  // A receipt may already be fulfilling this exact row; never book the same purchase twice.
  guardReceiptFulfillment(lifecycle.id, item.id);
  const recordStockAdded = (productId: number, productName: string, amount: number, amountSource: string, conversionText = '', conversion: CheckConversion | null = null) => {
    events.push(activityEvent({
      source: 'Mealie', target: 'Grocy', productName, entityRef: `grocy:${productId}`,
      category: 'inventory', message: `Added ${amount}${conversionText} to Grocy stock for "${productName}".`,
      reason: `"${mapping.mealieFoodName}" was checked off on the Mealie shopping list.`,
      details: {
        grocyProductId: productId, mealieFoodId: foodId, mealieFoodName: mapping.mealieFoodName, mealieItemId: item.id, amount, amountSource,
        ...(conversion ? { mealieQuantity: conversion.mealieQuantity, mealieUnitId: conversion.mealieUnitId, mealieUnitName: conversion.mealieUnitName, conversionFactor: conversion.factor } : {}),
      },
    }));
  };

  // Sub-product path: if this item was placed on the list by sub-product sync,
  // restock each sub-product individually using note amounts (user-editable) with
  // extras amounts as fallback. Sub-products were added because they were below
  // min stock by construction, so STOCK_ONLY_MIN_STOCK is always satisfied.
  if (subItems) {
    const names = subItems.map(s => s.name);
    const hasDuplicateNames = new Set(names).size !== names.length;
    if (hasDuplicateNames) {
      log.info(`[Mealie→Grocy] Duplicate sub-product names in "${mapping.grocyProductName}" — note overrides disabled`);
    }
    const noteAmounts = hasDuplicateNames ? null : parseSubProductNoteAmounts(item.note);
    const progress = state.mealieSubRestockProgress[item.id] ?? [];
    const failed: string[] = [];
    let cancelledChildren = 0;

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
        const outcome = await bookCheckStock(lifecycle, sub.grocyProductId, amount, sub.name);
        if (outcome === 'cancelled') {
          // Dropped earlier without writing: never report it as booked or retry it.
          log.warn(`[Mealie→Grocy] Booking for "${sub.name}" was cancelled earlier; not restocked`);
          recordBookingCancelled(events, sub.grocyProductId, sub.name, item.id, 'sub_product');
          cancelledChildren++;
        } else {
          stockAdded = true;
          recordStockAdded(sub.grocyProductId, sub.name, amount, source);
          log.info(`[Mealie→Grocy] Restocked "${sub.name}" qty=${amount} (from ${source})`);
        }
        progress.push(sub.grocyProductId);
        state.mealieSubRestockProgress[item.id] = [...progress];
        await saveSyncState(state);
      } catch (err) {
        if (err instanceof UncertainWriteError) throw err;
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
    // Children already in progress are skipped above, so a cancellation seen in an
    // earlier attempt is read back from the persisted bookings.
    if (cancelledChildren > 0 || getLifecycleBookings(lifecycle.id).some(booking => booking.status === 'cancelled')) {
      // The row is not fulfilled: keep it unsynced and the Grocy list untouched.
      return null;
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
  // Other values (negative, NaN) are kept so validation refuses them.
  const quantity = item.quantity === undefined || item.quantity === null || item.quantity === 0 ? 1 : item.quantity;

  // A planned booking already passed these checks when it was planned.
  const grocyProduct = grocyProductsById.get(mapping.grocyProductId);
  const noOwnStockRaw = Number(grocyProduct?.no_own_stock);
  if (!priorBooking && grocyProduct && Number.isFinite(noOwnStockRaw) && noOwnStockRaw !== 0) {
    log.info(`[Mealie→Grocy] Skipping "${mapping.grocyProductName}" — product has no own stock in Grocy`);
    return null;
  }

  // Check if we should only add stock for products with min_stock_amount > 0
  if (!priorBooking && await resolveStockOnlyMinStock()) {
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

  // B3.2: Add stock in Grocy, converted to the stock unit
  let booking: { productId: number; amount: number; conversion: CheckConversion | null };
  if (priorBooking) {
    booking = { productId: priorBooking.productId, amount: priorBooking.amount, conversion: priorBooking.conversion };
  } else {
    const ctx = unitContext as UnitContext;
    const unitId = shoppingItemUnitId(item);
    const converted = resolveCheckOffAmount(ctx, mapping.grocyProductId, quantity, unitId);
    const mealieUnitName = unitId ? ctx.mealieUnits.get(unitId)?.name ?? item.unit?.name ?? null : null;
    if (!converted.ok) {
      recordConversionSkipped(events, ctx, mapping, item, quantity, mealieUnitName, converted.reason);
      log.warn(`[Mealie→Grocy] Not booking "${mapping.grocyProductName}": ${quantity} ${mealieUnitName ?? '(no unit)'} cannot be converted to its stock unit (${converted.reason})`);
      return null;
    }
    booking = {
      productId: mapping.grocyProductId,
      amount: converted.amount,
      conversion: { mealieQuantity: quantity, mealieUnitId: unitId, mealieUnitName, factor: converted.factor },
    };
  }
  log.info(`[Mealie→Grocy] Adding stock: "${mapping.grocyProductName}" qty=${booking.amount} to Grocy`);

  try {
    const outcome = await bookCheckStock(lifecycle, booking.productId, booking.amount, mapping.grocyProductName, {}, booking.conversion ?? undefined);
    if (outcome === 'cancelled') {
      // Dropped earlier without writing: nothing is booked, synced or cleaned up.
      log.warn(`[Mealie→Grocy] Booking for "${mapping.grocyProductName}" was cancelled earlier; not restocked`);
      recordBookingCancelled(events, booking.productId, mapping.grocyProductName, item.id, 'row');
      return null;
    }
    const conversionText = booking.conversion && booking.conversion.factor !== 1
      ? ` (${booking.conversion.mealieQuantity}${booking.conversion.mealieUnitName ? ` ${booking.conversion.mealieUnitName}` : ''})`
      : '';
    recordStockAdded(booking.productId, mapping.grocyProductName, booking.amount, item.quantity ? 'shopping list quantity' : 'default quantity', conversionText, booking.conversion);
  } catch (error) {
    if (error instanceof UncertainWriteError) throw error;
    log.error(`[Mealie→Grocy] Failed to add stock for "${mapping.grocyProductName}":`, error);
    events.push(activityEvent({
      level: 'error', source: 'Mealie', target: 'Grocy', productName: mapping.grocyProductName,
      category: 'inventory', entityRef: `grocy:${mapping.grocyProductId}`,
      message: `Could not add ${booking.amount} to Grocy stock for "${mapping.grocyProductName}": ${describeSyncError(error)}`,
      reason: `"${mapping.mealieFoodName}" was checked off on the Mealie shopping list.`,
      details: { grocyProductId: booking.productId, mealieFoodId: foodId, mealieItemId: item.id, amount: booking.amount, error: describeSyncError(error) },
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

/** Sub-product rows written by the low-stock sync; null for normal rows. */
function parseSubProductItems(item: ShoppingListItemOut_Output): SubProductItem[] | null {
  const rawSubItemsValue = (item.extras as Record<string, unknown> | undefined)?.[GMS_ITEMS_KEY];
  const rawSubItems: unknown = typeof rawSubItemsValue === 'string'
    ? (() => { try { return JSON.parse(rawSubItemsValue); } catch { return null; } })()
    : rawSubItemsValue;
  return Array.isArray(rawSubItems) && rawSubItems.length > 0 && rawSubItems.every(isValidSubProductItem)
    ? rawSubItems as SubProductItem[]
    : null;
}

const CONVERSION_SKIP_REASONS: Record<CheckOffFailure, string> = {
  unknown_product: 'The Grocy product or its stock unit is unknown.',
  missing_unit: 'The row has no unit, and the product is bought in a different unit than it is stocked in.',
  purchase_unit_ambiguous: 'The row uses the purchase unit, which differs from the stock unit; its amount could mean either.',
  no_conversion: 'No Grocy unit conversion links this unit to the stock unit.',
  invalid_amount: 'The amount is not a positive number after conversion.',
};

function recordConversionSkipped(
  events: HistoryEventInput[],
  ctx: UnitContext,
  mapping: { grocyProductId: number; grocyProductName: string },
  item: ShoppingListItemOut_Output,
  quantity: number,
  mealieUnitName: string | null,
  reason: CheckOffFailure,
) {
  const stockQu = ctx.grocyProducts.get(mapping.grocyProductId)?.quIdStock ?? null;
  const stockUnitName = stockQu !== null ? ctx.grocyUnitNames.get(stockQu) ?? null : null;
  events.push(activityEvent({
    level: 'warning', source: 'Mealie', target: 'Grocy', productName: mapping.grocyProductName,
    category: 'inventory', entityRef: `grocy:${mapping.grocyProductId}`,
    message: `Did not add stock for "${mapping.grocyProductName}": ${quantity} ${mealieUnitName ?? '(no unit)'} cannot be converted to ${stockUnitName ?? 'its stock unit'}.`,
    reason: `${CONVERSION_SKIP_REASONS[reason]} Add the stock manually in Grocy. Adding a conversion later does not re-process this row; uncheck and re-check it in Mealie to retry.`,
    details: { grocyProductId: mapping.grocyProductId, mealieItemId: item.id, mealieQuantity: quantity, mealieUnitId: shoppingItemUnitId(item), mealieUnitName, stockUnitName, reason },
  }));
}

/**
 * A normal row books one product, so re-checking it is a safe retry. A
 * sub-product row may have booked other children already; re-checking would
 * book those again, so only manual booking of the missing child is advised.
 */
function recordBookingCancelled(events: HistoryEventInput[], productId: number, productName: string, mealieItemId: string, scope: 'row' | 'sub_product') {
  events.push(activityEvent({
    level: 'warning', source: 'Mealie', target: 'Grocy', productName, category: 'inventory', entityRef: `grocy:${productId}`,
    message: `Did not add stock for "${productName}": its booking was cancelled earlier.`,
    reason: scope === 'row'
      ? 'Nothing was written to Grocy. Uncheck and re-check the row in Mealie to book it again.'
      : `Nothing was written to Grocy for "${productName}". Add its stock manually in Grocy; do not re-check the Mealie row, because its other products were already booked.`,
    details: { grocyProductId: productId, mealieItemId, scope },
  }));
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

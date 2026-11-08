/**
 * Grocy→Mealie "checked" propagation (a.k.a. direction 5).
 *
 * Upstream sync only flows "checked" from Mealie to Grocy (checked Mealie item
 * → restock Grocy). A user completing a row on the Grocy shopping list, buying
 * a mapped product directly in Grocy, or undoing such a booking ("put back")
 * had no way to update the Mealie side — the Mealie item stayed unchecked (or
 * checked forever). This poll mirrors the Grocy side onto the Mealie shopping
 * item that matches the same mapped product, in both directions:
 *
 *  1. Grocy shopping-list row `done` 0→1  → check the matching Mealie item.
 *  2. Grocy shopping-list row `done` 1→0  → uncheck it (explicit "put back").
 *  3. New positive stock-log booking for a mapped product → check it
 *     (Grocy's UI completes shopping rows by booking stock; the row signal and
 *     the booking signal overlap and are both idempotent).
 *  4. Newest stock-log booking for a mapped product marked `undone` → uncheck
 *     it (Grocy undo mutates the booking row in place; no negative twin).
 *  5. A Mealie item that this poll had previously checked, now unchecked in
 *     Mealie → set the matching Grocy shopping row back to `done=0`.
 *     Stock is never silently reverted — only the row flag is mirrored.
 *
 * Ping-pong safety with the Mealie→Grocy poll (direction 3): this step runs
 * BEFORE it in the scheduler cycle and writes its propagated checked states
 * into `mealieCheckedItems`, so direction 3 treats them as already processed
 * and does not re-book stock for a purchase Grocy has already recorded.
 *
 * Every action is guarded by "is the target already in the desired state?",
 * so overlapping signals converge instead of oscillating.
 *
 * Requires Grocy 4.x: the `done` column on `shopping_list` and the `stock_log`
 * entity with `query[]`/`order=k:v` filtering (Grocy silently ignores the v3
 * `filter[...]`/`order_desc` params, so all reads go through the typed
 * wrappers in ../grocy/types).
 *
 * Opt-in via SYNC_GROCYSIDE_CHECKED=true.
 */
import { config } from '../config';
import { db } from '../db';
import { productMappings } from '../db/schema';
import {
  getGrocyEntities,
  getGrocyMaxStockLogId,
  getGrocyNewestStockLogForProduct,
  getGrocyStockLogSince,
  updateGrocyEntity,
} from '../grocy/types';
import type { GrocyShoppingRow, GrocyStockLogRow } from '../grocy/types';
import type { HistoryEventInput } from '../history-store';
import { log } from '../logger';
import type { MealieShoppingItem } from '../mealie/types';
import { resolveShoppingListId } from '../settings';
import { updateShoppingListItem } from '../use-cases/shopping/list';
import { activityEvent, describeSyncError } from './activity';
import { fetchAllMealieShoppingItems } from './helpers';
import { getSyncState, saveSyncState, type SyncStateData } from './state';

export interface GrocyCheckedToMealieSyncSummary {
  rowsChecked: number;
  rowsUnchecked: number;
  journalAdds: number;
  journalReverts: number;
  rowMirrorUpdates: number;
  failedItems: number;
}

export interface GrocyCheckedToMealiePollResult {
  status: 'ok' | 'partial' | 'skipped' | 'error';
  reason?: string;
  summary: GrocyCheckedToMealieSyncSummary;
  events?: HistoryEventInput[];
}

function createEmptySummary(): GrocyCheckedToMealieSyncSummary {
  return {
    rowsChecked: 0,
    rowsUnchecked: 0,
    journalAdds: 0,
    journalReverts: 0,
    rowMirrorUpdates: 0,
    failedItems: 0,
  };
}

function isDone(row: GrocyShoppingRow): boolean {
  return Number(row.done ?? 0) === 1;
}

function itemChecked(item: MealieShoppingItem): boolean {
  return item.checked ?? false;
}

/** Prefer the item that still needs the transition; fall back to any (no-op). */
function pickItem(items: MealieShoppingItem[], targetChecked: boolean): MealieShoppingItem | null {
  const pending = items.find(item => itemChecked(item) !== targetChecked);
  return pending ?? items[0] ?? null;
}

interface PollContext {
  state: SyncStateData;
  events: HistoryEventInput[];
  summary: GrocyCheckedToMealieSyncSummary;
}

/**
 * Push a checked state onto a Mealie shopping item and record the snapshots
 * that keep the Mealie→Grocy poll from re-processing the same purchase.
 * Returns 'done' when a write was performed, 'already' when the item was
 * already in the target state, 'failed' on write errors.
 */
async function applyMealieChecked(
  item: MealieShoppingItem,
  checked: boolean,
  productName: string,
  reason: string,
  ctx: PollContext,
): Promise<'done' | 'already' | 'failed'> {
  if (itemChecked(item) === checked) {
    // Already converged (e.g. the overlapping row + booking signals). The
    // snapshot pin must still be written so direction 3 skips the item.
    if (checked) {
      ctx.state.mealieCheckedItems[item.id] = true;
    }
    return 'already';
  }

  try {
    await updateShoppingListItem({ itemId: item.id, checked });
  } catch (error) {
    ctx.summary.failedItems++;
    ctx.events.push(activityEvent({
      message: `Failed to mark "${productName}" as ${checked ? 'checked' : 'unchecked'} in Mealie: ${describeSyncError(error)}`,
      reason: 'mealie-checked-propagation-failed',
      source: 'Grocy',
      target: 'Mealie',
      productName,
      entityRef: item.id,
      entityKind: 'shopping_item',
      level: 'error',
    }));
    return 'failed';
  }

  // Mutate the in-memory copy so later signals in this same poll see the
  // converged state instead of stacking duplicate writes.
  item.checked = checked;
  ctx.state.grocyCheckedMealieSnapshotById[item.id] = checked;
  if (checked) {
    // Pin direction 3 (mealie-to-grocy): the purchase lives in Grocy already,
    // do not restock it a second time when the Mealie-side poll catches up.
    ctx.state.mealieCheckedItems[item.id] = true;
    ctx.state.mealieCheckedAt[item.id] = new Date().toISOString();
    ctx.state.mealieItemsSyncedToGrocy[item.id] = new Date().toISOString();
  } else {
    delete ctx.state.mealieCheckedAt[item.id];
    delete ctx.state.mealieItemsSyncedToGrocy[item.id];
  }
  ctx.events.push(activityEvent({
    message: `Marked "${productName}" as ${checked ? 'checked' : 'unchecked'} in Mealie.`,
    reason,
    source: 'Grocy',
    target: 'Mealie',
    productName,
    entityRef: item.id,
    entityKind: 'shopping_item',
  }));
  return 'done';
}

export async function pollGrocyCheckedToMealie(): Promise<GrocyCheckedToMealiePollResult> {
  if (!config.syncGrocySideChecked) {
    return { status: 'skipped', reason: 'disabled', summary: createEmptySummary() };
  }

  log.info('[Grocy-checked→Mealie] Polling for Grocy-side shopping completions...');
  const summary = createEmptySummary();
  const events: HistoryEventInput[] = [];

  const shoppingListId = await resolveShoppingListId();
  if (!shoppingListId) {
    log.warn('[Grocy-checked→Mealie] No shopping list configured — skipping poll');
    return { status: 'skipped', reason: 'no-shopping-list', summary };
  }

  try {
    const mappings = await db.select().from(productMappings);
    if (mappings.length === 0) {
      return { status: 'skipped', reason: 'no-product-mappings', summary };
    }

    const mappingByFoodId = new Map(mappings.map(m => [m.mealieFoodId, m]));
    const mappingByProductId = new Map(
      mappings.map(m => [Number(m.grocyProductId), m] as const),
    );

    const state = await getSyncState();
    const ctx: PollContext = { state, events, summary };

    const items = await fetchAllMealieShoppingItems(shoppingListId);
    const itemsByFoodId = new Map<string, MealieShoppingItem[]>();
    for (const item of items) {
      if (!item.foodId) continue;
      const list = itemsByFoodId.get(item.foodId) ?? [];
      list.push(item);
      itemsByFoodId.set(item.foodId, list);
    }

    const rows = await getGrocyEntities('shopping_list') as GrocyShoppingRow[];
    const rowsByProductId = new Map<number, GrocyShoppingRow[]>();
    for (const row of rows) {
      if (row.product_id == null) continue;
      const list = rowsByProductId.get(Number(row.product_id)) ?? [];
      list.push(row);
      rowsByProductId.set(Number(row.product_id), list);
    }

    if (!state.grocyCheckedBootstrapped) {
      // First poll: snapshot Grocy-side state without propagating anything,
      // so pre-existing checked rows / historic bookings do not mass-update
      // Mealie on deployment.
      state.grocyCheckedRowDoneById = {};
      for (const row of rows) {
        if (row.id == null) continue;
        state.grocyCheckedRowDoneById[Number(row.id)] = isDone(row);
      }
      state.grocyCheckedJournalCursor = await getGrocyMaxStockLogId();
      state.grocyCheckedBootstrapped = true;
      await saveSyncState(state);
      log.info(
        `[Grocy-checked→Mealie] Bootstrap snapshot taken (${rows.length} row(s), journal cursor ${state.grocyCheckedJournalCursor})`,
      );
      return { status: 'ok', reason: 'bootstrap', summary, events };
    }

    // --- Signal 1/2: shopping-row done transitions -------------------------
    const liveRowIds = new Set<number>();
    for (const row of rows) {
      if (row.id == null || row.product_id == null) continue;
      const rowId = Number(row.id);
      liveRowIds.add(rowId);
      const mapping = mappingByProductId.get(Number(row.product_id));
      if (!mapping) continue;

      const nowDone = isDone(row);
      const previousDone = state.grocyCheckedRowDoneById[rowId];
      state.grocyCheckedRowDoneById[rowId] = nowDone;
      if (previousDone === nowDone) continue;

      const itemsForFood = itemsByFoodId.get(mapping.mealieFoodId);
      if (!itemsForFood?.length) continue;
      const item = pickItem(itemsForFood, nowDone);
      if (!item) continue;

      const outcome = await applyMealieChecked(
        item,
        nowDone,
        mapping.grocyProductName ?? mapping.mealieFoodName,
        nowDone ? 'grocy-shopping-row-checked' : 'grocy-shopping-row-unchecked',
        ctx,
      );
      if (outcome === 'done') {
        if (nowDone) summary.rowsChecked++;
        else summary.rowsUnchecked++;
      }
    }
    // Rows that disappeared completed their lifecycle (Grocy removes checked
    // rows when a shopping list is "completed" — that books stock; the booking
    // signal covers it). Prune snapshots without inferring an uncheck.
    for (const rowId of Object.keys(state.grocyCheckedRowDoneById)) {
      if (!liveRowIds.has(Number(rowId))) {
        delete state.grocyCheckedRowDoneById[Number(rowId)];
      }
    }

    // --- Signal 3: new positive bookings for mapped products ---------------
    let cursor = state.grocyCheckedJournalCursor;
    const entries: GrocyStockLogRow[] = await getGrocyStockLogSince(cursor);
    for (const entry of entries) {
      const entryId = Number(entry.id ?? 0);
      if (entryId > cursor) cursor = entryId;
      const mapping = mappingByProductId.get(Number(entry.product_id));
      if (!mapping) continue;
      const amount = Number(entry.amount ?? 0);
      if (!(amount > 0)) continue; // consumption/spoilage is not a purchase
      if (Number(entry.undone ?? 0) === 1) continue;

      const itemsForFood = itemsByFoodId.get(mapping.mealieFoodId);
      if (!itemsForFood?.length) continue;
      const item = pickItem(itemsForFood, true);
      if (!item || itemChecked(item)) continue;

      const outcome = await applyMealieChecked(
        item,
        true,
        mapping.grocyProductName ?? mapping.mealieFoodName,
        'grocy-stock-booking-added',
        ctx,
      );
      if (outcome === 'done') summary.journalAdds++;
    }
    state.grocyCheckedJournalCursor = cursor;

    // --- Signal 4: "put back" — newest booking for the product was undone ---
    for (const mapping of mappings) {
      const itemsForFood = itemsByFoodId.get(mapping.mealieFoodId);
      if (!itemsForFood?.length) continue;
      const checkedItem = itemsForFood.find(item => itemChecked(item));
      if (!checkedItem) continue;

      const newest = await getGrocyNewestStockLogForProduct(Number(mapping.grocyProductId));
      if (!newest) continue;
      if (!(Number(newest.amount ?? 0) > 0)) continue;
      if (Number(newest.undone ?? 0) !== 1) continue;

      const outcome = await applyMealieChecked(
        checkedItem,
        false,
        mapping.grocyProductName ?? mapping.mealieFoodName,
        'grocy-stock-booking-undone',
        ctx,
      );
      if (outcome === 'done') summary.journalReverts++;
    }

    // --- Signal 5: mirror Mealie-side unchecks back onto Grocy rows --------
    // Only for items this poll previously checked; stock is never reverted.
    const liveItemIds = new Set(items.map(item => item.id));
    for (const mapping of mappings) {
      const itemsForFood = itemsByFoodId.get(mapping.mealieFoodId);
      if (!itemsForFood?.length) continue;
      for (const item of itemsForFood) {
        if (state.grocyCheckedMealieSnapshotById[item.id] !== true) continue;
        if (itemChecked(item)) continue; // still checked on Mealie side — fine
        const rowsForProduct = rowsByProductId.get(Number(mapping.grocyProductId));
        const doneRow = rowsForProduct?.find(row => isDone(row));
        if (!doneRow || doneRow.id == null) continue;
        try {
          await updateGrocyEntity('shopping_list', Number(doneRow.id), { done: 0 });
          state.grocyCheckedMealieSnapshotById[item.id] = false;
          summary.rowMirrorUpdates++;
          events.push(activityEvent({
            message: `Set Grocy shopping row for "${mapping.grocyProductName ?? mapping.mealieFoodName}" back to unchecked (unchecked in Mealie).`,
            reason: 'grocy-row-unchecked-mirror',
            source: 'Mealie',
            target: 'Grocy',
            productName: mapping.grocyProductName ?? mapping.mealieFoodName,
            entityRef: String(doneRow.id),
            entityKind: 'shopping_item',
          }));
        } catch (error) {
          summary.failedItems++;
          events.push(activityEvent({
            message: `Failed to uncheck Grocy shopping row for "${mapping.grocyProductName ?? mapping.mealieFoodName}": ${describeSyncError(error)}`,
            reason: 'grocy-row-unchecked-mirror-failed',
            source: 'Mealie',
            target: 'Grocy',
            productName: mapping.grocyProductName ?? mapping.mealieFoodName,
            entityKind: 'shopping_item',
            level: 'error',
          }));
        }
      }
    }
    for (const itemId of Object.keys(state.grocyCheckedMealieSnapshotById)) {
      if (!liveItemIds.has(itemId)) {
        delete state.grocyCheckedMealieSnapshotById[itemId];
      }
    }

    await saveSyncState(state);

    const status = summary.failedItems > 0 ? 'partial' : 'ok';
    if (summary.rowsChecked + summary.rowsUnchecked + summary.journalAdds
      + summary.journalReverts + summary.rowMirrorUpdates > 0) {
      log.info(
        `[Grocy-checked→Mealie] Mirrored ${summary.rowsChecked} row-checked / ${summary.rowsUnchecked} row-unchecked / `
        + `${summary.journalAdds} booking / ${summary.journalReverts} put-back / ${summary.rowMirrorUpdates} row-mirror update(s)`,
      );
    }
    return { status, summary, events };
  } catch (error) {
    log.error('[Grocy-checked→Mealie] Poll failed:', error);
    return {
      status: 'error',
      summary,
      events: [{
        kind: 'issue',
        level: 'error',
        category: 'sync',
        entityKind: 'system',
        entityRef: 'grocy_checked_to_mealie',
        message: `Grocy-checked poll failed: ${describeSyncError(error)}`,
      }],
    };
  }
}

import {
  addProductStock,
  consumeProductStockExact,
  findStockLogRowsByNote,
  undoStockTransaction,
  type GrocyStockLogRow,
  type StockLogEntry,
} from '../grocy/types';
import { HouseholdsShoppingListItemsService } from '../mealie';
import type { MealieShoppingItem } from '../mealie/types';
import { rowIdentityOf } from './demand-observer';
import { applyGrocyAddSideEffects } from './effect-hooks';
import {
  beginAttempt,
  classifyWriteError,
  completeEffect,
  describeError,
  effectMarker,
  getEffect,
  markerNeedle,
  appendEvidence,
  type LedgerTx,
  type ShopEffect,
  type EffectStatus,
} from './ledger';

export interface GrocyAddPayload {
  productId: number;
  /** Amount in the product's stock quantity unit. */
  amount: number;
  price?: number;
  shoppingLocationId?: number;
  label?: string;
}

export interface GrocyConsumePayload {
  productId: number;
  amount: number;
  label?: string;
}

export interface GrocyUndoPayload {
  transactionId: string;
  label?: string;
}

export interface MealieReducePayload {
  itemId: string;
  shoppingListId: string;
  /** Row quantity when the reduction was planned; the write only applies if it is unchanged. */
  expectedBefore: number;
  /** Target quantity; zero or less deletes the row. */
  expectedAfter: number;
  /** Food, unit and sub-product identity the reduction was planned for. */
  expectedIdentity: string;
  label?: string;
}

export interface EffectRunnerDeps {
  addStock: typeof addProductStock;
  consumeStock: typeof consumeProductStockExact;
  undoTransaction: typeof undoStockTransaction;
  findStockLogRows: typeof findStockLogRowsByNote;
  getMealieItem: (itemId: string) => Promise<MealieShoppingItem | null>;
  updateMealieItem: (itemId: string, body: Parameters<typeof HouseholdsShoppingListItemsService.updateOneApiHouseholdsShoppingItemsItemIdPut>[1]) => Promise<unknown>;
  deleteMealieItem: (itemId: string) => Promise<unknown>;
  now: () => Date;
}

async function getMealieItemOrNull(itemId: string): Promise<MealieShoppingItem | null> {
  try {
    return await HouseholdsShoppingListItemsService.getOneApiHouseholdsShoppingItemsItemIdGet(itemId);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 404) return null;
    throw error;
  }
}

export const defaultEffectRunnerDeps: EffectRunnerDeps = {
  addStock: addProductStock,
  consumeStock: consumeProductStockExact,
  undoTransaction: undoStockTransaction,
  findStockLogRows: findStockLogRowsByNote,
  getMealieItem: getMealieItemOrNull,
  updateMealieItem: (itemId, body) => HouseholdsShoppingListItemsService.updateOneApiHouseholdsShoppingItemsItemIdPut(itemId, body),
  deleteMealieItem: itemId => HouseholdsShoppingListItemsService.deleteOneApiHouseholdsShoppingItemsItemIdDelete(itemId),
  now: () => new Date(),
};

function transactionIdOf(entries: StockLogEntry[] | undefined): string | null {
  const id = entries?.find(entry => entry.transaction_id)?.transaction_id;
  return id ? String(id) : null;
}

function isUndone(row: GrocyStockLogRow): boolean {
  return row.undone === true || row.undone === 1 || row.undone === '1';
}

/** Applied bookkeeping shared by direct, verified and user-resolved bookings. */
function defaultGrocyAddHook(tx: LedgerTx, effect: ShopEffect<GrocyAddPayload>): void {
  applyGrocyAddSideEffects(tx, effect, { writeCheckGuardToState: false });
}

export interface GrocyAddRunOptions {
  /** Runs in the same transaction that marks the effect applied. */
  onApplied?: (tx: LedgerTx, effect: ShopEffect<GrocyAddPayload>) => void;
}

/**
 * Run a Grocy purchase booking at most once per explicit decision. Already
 * applied effects are skipped; unknown effects are left for verification.
 */
export async function runGrocyAddEffect(
  effect: ShopEffect<GrocyAddPayload>,
  deps: EffectRunnerDeps = defaultEffectRunnerDeps,
  options: GrocyAddRunOptions = {},
): Promise<EffectStatus> {
  if (!beginAttempt(effect.id, deps.now())) {
    return getEffect(effect.id)?.status ?? effect.status;
  }
  const { payload } = effect;
  try {
    const entries = await deps.addStock(payload.productId, {
      amount: payload.amount,
      note: effectMarker(effect.id),
      ...(payload.price !== undefined ? { price: payload.price } : {}),
      ...(payload.shoppingLocationId !== undefined ? { shoppingLocationId: payload.shoppingLocationId } : {}),
    });
    const transactionId = transactionIdOf(entries);
    completeEffect(effect.id, {
      status: 'applied',
      externalRef: transactionId,
      evidence: { stockLogIds: entries?.map(entry => entry.id).filter(Boolean) ?? [], appliedAt: deps.now().toISOString() },
      fromStatuses: ['in_flight'],
    }, tx => (options.onApplied ?? defaultGrocyAddHook)(tx, effect), deps.now());
    return 'applied';
  } catch (error) {
    const outcome = classifyWriteError(error);
    completeEffect(effect.id, {
      status: outcome,
      error: describeError(error),
      evidence: { lastFailureAt: deps.now().toISOString(), lastFailureStatus: (error as { status?: number }).status ?? null },
      fromStatuses: ['in_flight'],
    }, undefined, deps.now());
    return outcome;
  }
}

export type VerificationResult = 'applied' | 'still_unknown';

/**
 * Look for the effect's note marker in Grocy's stock log. Absence of the
 * marker is never treated as proof that the write did not happen.
 */
export async function verifyGrocyAddEffect(
  effect: ShopEffect<GrocyAddPayload>,
  deps: EffectRunnerDeps = defaultEffectRunnerDeps,
  options: GrocyAddRunOptions = {},
): Promise<VerificationResult> {
  const verifiedAt = deps.now().toISOString();
  let rows: GrocyStockLogRow[];
  try {
    rows = await deps.findStockLogRows(effect.payload.productId, markerNeedle(effect.id));
  } catch (error) {
    appendEvidence(effect.id, { lastVerification: { at: verifiedAt, result: 'query_failed', error: describeError(error) } }, deps.now());
    return 'still_unknown';
  }
  const matching = rows.filter(row => typeof row.note === 'string' && row.note.includes(markerNeedle(effect.id)));
  if (matching.length === 0) {
    appendEvidence(effect.id, { lastVerification: { at: verifiedAt, result: 'marker_not_found' } }, deps.now());
    return 'still_unknown';
  }
  const undone = matching.every(isUndone);
  completeEffect(effect.id, {
    status: 'applied',
    externalRef: matching[0].transaction_id ? String(matching[0].transaction_id) : null,
    evidence: {
      lastVerification: { at: verifiedAt, result: 'marker_found', stockLogIds: matching.map(row => row.id) },
      // The user undid the booking in Grocy; respect that and never re-book.
      undoneByUser: undone,
    },
    fromStatuses: ['unknown'],
  }, undone ? undefined : tx => (options.onApplied ?? defaultGrocyAddHook)(tx, effect), deps.now());
  return 'applied';
}

export async function runGrocyConsumeEffect(
  effect: ShopEffect<GrocyConsumePayload>,
  deps: EffectRunnerDeps = defaultEffectRunnerDeps,
): Promise<EffectStatus> {
  if (!beginAttempt(effect.id, deps.now())) return getEffect(effect.id)?.status ?? effect.status;
  try {
    const entries = await deps.consumeStock(effect.payload.productId, effect.payload.amount);
    completeEffect(effect.id, {
      status: 'applied',
      externalRef: transactionIdOf(entries),
      evidence: { stockLogIds: entries?.map(entry => entry.id).filter(Boolean) ?? [] },
      fromStatuses: ['in_flight'],
    }, undefined, deps.now());
    return 'applied';
  } catch (error) {
    const outcome = classifyWriteError(error);
    completeEffect(effect.id, { status: outcome, error: describeError(error), fromStatuses: ['in_flight'] }, undefined, deps.now());
    return outcome;
  }
}

export async function runGrocyUndoEffect(
  effect: ShopEffect<GrocyUndoPayload>,
  deps: EffectRunnerDeps = defaultEffectRunnerDeps,
): Promise<EffectStatus> {
  if (!beginAttempt(effect.id, deps.now())) return getEffect(effect.id)?.status ?? effect.status;
  try {
    await deps.undoTransaction(effect.payload.transactionId);
    completeEffect(effect.id, { status: 'applied', externalRef: effect.payload.transactionId, fromStatuses: ['in_flight'] }, undefined, deps.now());
    return 'applied';
  } catch (error) {
    const outcome = classifyWriteError(error);
    completeEffect(effect.id, { status: outcome, error: describeError(error), fromStatuses: ['in_flight'] }, undefined, deps.now());
    return outcome;
  }
}

function quantitiesEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-6;
}

/**
 * Compare-and-set reduction of a Mealie shopping row. The write only happens
 * when the row still has the planned identity (food, unit, sub-products) and
 * quantity, re-checked immediately before writing. The user's own edits always
 * win: anything unexpected marks the effect `superseded`.
 *
 * An uncertain earlier attempt is only resolved by definitive evidence: the
 * row at the target state is `applied`, a changed row is `superseded`. An
 * unchanged row is not proof that the write failed, so it stays `unknown`.
 */
export async function runMealieReduceEffect(
  effect: ShopEffect<MealieReducePayload>,
  deps: EffectRunnerDeps = defaultEffectRunnerDeps,
): Promise<EffectStatus> {
  const { payload } = effect;
  const deleting = payload.expectedAfter <= 0;
  const now = () => deps.now();

  if (effect.status === 'unknown') {
    let item: MealieShoppingItem | null;
    try {
      item = await deps.getMealieItem(payload.itemId);
    } catch (error) {
      appendEvidence(effect.id, { lastVerification: { at: now().toISOString(), result: 'read_failed', error: describeError(error) } }, now());
      return 'unknown';
    }
    if (!item) {
      const status = deleting ? 'applied' : 'superseded';
      completeEffect(effect.id, { status, evidence: { verifiedBy: 're-read', rowMissing: true }, fromStatuses: ['unknown'] }, undefined, now());
      return status;
    }
    const sameIdentity = rowIdentityOf(item) === payload.expectedIdentity && !item.checked;
    const quantity = item.quantity ?? 0;
    if (sameIdentity && !deleting && quantitiesEqual(quantity, payload.expectedAfter)) {
      completeEffect(effect.id, { status: 'applied', evidence: { verifiedBy: 're-read' }, fromStatuses: ['unknown'] }, undefined, now());
      return 'applied';
    }
    if (!sameIdentity || !quantitiesEqual(quantity, payload.expectedBefore)) {
      completeEffect(effect.id, {
        status: 'superseded',
        evidence: { verifiedBy: 're-read', observedQuantity: quantity, identityChanged: !sameIdentity },
        fromStatuses: ['unknown'],
      }, undefined, now());
      return 'superseded';
    }
    appendEvidence(effect.id, { lastVerification: { at: now().toISOString(), result: 'row_unchanged' } }, now());
    return 'unknown';
  }

  if (!beginAttempt(effect.id, now())) return getEffect(effect.id)?.status ?? effect.status;
  let item: MealieShoppingItem | null;
  try {
    item = await deps.getMealieItem(payload.itemId);
  } catch (error) {
    // Only a read failed; nothing was written.
    completeEffect(effect.id, { status: 'not_applied', error: describeError(error), fromStatuses: ['in_flight'] }, undefined, now());
    return 'not_applied';
  }
  if (!item) {
    const status = deleting ? 'applied' : 'superseded';
    completeEffect(effect.id, { status, evidence: { rowMissing: true }, fromStatuses: ['in_flight'] }, undefined, now());
    return status;
  }
  const quantity = item.quantity ?? 0;
  const sameIdentity = rowIdentityOf(item) === payload.expectedIdentity;
  if (item.checked || !sameIdentity || !quantitiesEqual(quantity, payload.expectedBefore)) {
    completeEffect(effect.id, {
      status: 'superseded',
      evidence: { observedQuantity: quantity, observedChecked: Boolean(item.checked), identityChanged: !sameIdentity },
      fromStatuses: ['in_flight'],
    }, undefined, now());
    return 'superseded';
  }
  try {
    if (deleting) {
      await deps.deleteMealieItem(payload.itemId);
    } else {
      await deps.updateMealieItem(payload.itemId, {
        shoppingListId: item.shoppingListId,
        quantity: payload.expectedAfter,
        foodId: item.foodId ?? undefined,
        unitId: item.unitId ?? undefined,
        labelId: item.labelId ?? undefined,
        note: item.note ?? null,
        extras: item.extras ?? undefined,
        checked: false,
        position: item.position,
      });
    }
    completeEffect(effect.id, { status: 'applied', evidence: { appliedAt: now().toISOString() }, fromStatuses: ['in_flight'] }, undefined, now());
    return 'applied';
  } catch (error) {
    const outcome = classifyWriteError(error);
    completeEffect(effect.id, { status: outcome, error: describeError(error), fromStatuses: ['in_flight'] }, undefined, now());
    return outcome;
  }
}

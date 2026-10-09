import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { createTestDb } = await import('@/test-utils/test-db');
  return { db: createTestDb() };
});

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { checkLifecycles, discrepancies, lowStockAccountedRestocks, shopEffects, syncState } from '@/lib/db/schema';
import {
  beginAttempt,
  classifyWriteError,
  ensureEffect,
  getEffect,
  recoverInterruptedEffects,
  UncertainWriteError,
} from '../ledger';
import { bookCheckStock, findOpenLifecycle, getLifecycleBookings, handleUncheckedItem, openCheckLifecycle, reconcileCheckLifecycles, retireLegacyCheckLifecycle, setLifecycleStatus } from '../check-lifecycles';
import { resolveUnknownEffect } from '../effect-resolution';
import { defaultEffectRunnerDeps, runGrocyAddEffect, type EffectRunnerDeps, type GrocyAddPayload } from '../effect-runners';

function deps(overrides: Partial<EffectRunnerDeps> = {}): EffectRunnerDeps {
  return {
    ...defaultEffectRunnerDeps,
    addStock: vi.fn(async () => [{ id: 1, transaction_id: 'tx-1' }]),
    findStockLogRows: vi.fn(async () => []),
    now: () => new Date('2026-10-06T12:00:00Z'),
    ...overrides,
  };
}

function apiError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

beforeEach(() => {
  db.delete(discrepancies).run();
  db.delete(shopEffects).run();
  db.delete(checkLifecycles).run();
  db.delete(lowStockAccountedRestocks).run();
  db.delete(syncState).run();
});

describe('error classification', () => {
  it('treats only definitive failures as not applied', () => {
    expect(classifyWriteError(apiError(400))).toBe('not_applied');
    expect(classifyWriteError(apiError(404))).toBe('not_applied');
    expect(classifyWriteError(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }))).toBe('not_applied');
    expect(classifyWriteError(apiError(500))).toBe('unknown');
    expect(classifyWriteError(apiError(502))).toBe('unknown');
    expect(classifyWriteError(apiError(408))).toBe('unknown');
    expect(classifyWriteError(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }))).toBe('unknown');
    expect(classifyWriteError(new Error('timeout'))).toBe('unknown');
  });
});

describe('effect ledger', () => {
  it('creates one effect per key and claims each attempt once', () => {
    const input = { effectKey: 'k', kind: 'grocy_add' as const, sourceKind: 'receipt' as const, sourceRef: 'r', payload: { productId: 1, amount: 1 } };
    const first = ensureEffect(input);
    const second = ensureEffect({ ...input, payload: { productId: 2, amount: 9 } });
    expect(second.id).toBe(first.id);
    expect(second.payload).toEqual({ productId: 1, amount: 1 });
    expect(beginAttempt(first.id)).toBe(true);
    expect(beginAttempt(first.id)).toBe(false);
  });

  it('turns writes interrupted in flight into unknown, never into a retry', () => {
    const effect = ensureEffect({ effectKey: 'k2', kind: 'grocy_add', sourceKind: 'receipt', sourceRef: 'r', payload: { productId: 1, amount: 1 } });
    beginAttempt(effect.id);
    expect(recoverInterruptedEffects()).toBe(1);
    expect(getEffect(effect.id)?.status).toBe('unknown');
    expect(beginAttempt(effect.id)).toBe(false);
  });

  it('writes the note marker and records receipt restocks atomically with the booking', async () => {
    const addStock = vi.fn(async () => [{ id: 7, transaction_id: 'tx-7' }]);
    const effect = ensureEffect<GrocyAddPayload>({ effectKey: 'k3', kind: 'grocy_add', sourceKind: 'receipt', sourceRef: 'r', payload: { productId: 5, amount: 2, price: 1.25 } });
    expect(await runGrocyAddEffect(effect, deps({ addStock }))).toBe('applied');
    expect(addStock).toHaveBeenCalledWith(5, { amount: 2, note: `[gms:${effect.id}]`, price: 1.25 });
    expect(getEffect(effect.id)?.externalRef).toBe('tx-7');
    expect(db.select().from(lowStockAccountedRestocks).all()).toEqual([
      expect.objectContaining({ effectId: effect.id, grocyProductId: 5, stockAmount: 2, consumedAt: null }),
    ]);
  });
});

describe('ledger-backed manual checks', () => {
  it('reuses the lifecycle across retries and never books an applied child twice', async () => {
    const addStock = vi.fn()
      .mockResolvedValueOnce([{ id: 1, transaction_id: 'tx-a' }])
      .mockRejectedValueOnce(apiError(400))
      .mockResolvedValueOnce([{ id: 2, transaction_id: 'tx-b' }]);
    const lifecycle = openCheckLifecycle({ id: 'row-1', foodId: 'food' }, 100);
    expect(await bookCheckStock(lifecycle, 201, 2, 'Child A', deps({ addStock }))).toBe('applied');
    await expect(bookCheckStock(lifecycle, 202, 1, 'Child B', deps({ addStock }))).rejects.toMatchObject({ status: 400 });
    setLifecycleStatus(lifecycle.id, 'failed');

    const retried = openCheckLifecycle({ id: 'row-1', foodId: 'food' }, 100);
    expect(retried.id).toBe(lifecycle.id);
    expect(await bookCheckStock(retried, 201, 2, 'Child A', deps({ addStock }))).toBe('already_applied');
    expect(await bookCheckStock(retried, 202, 1, 'Child B', deps({ addStock }))).toBe('applied');
    expect(addStock).toHaveBeenCalledTimes(3);
  });

  it('never retries an uncertain booking when its marker is missing', async () => {
    const addStock = vi.fn().mockRejectedValue(apiError(502));
    const findStockLogRows = vi.fn(async () => []);
    const lifecycle = openCheckLifecycle({ id: 'row-2', foodId: 'food' }, 100);
    await expect(bookCheckStock(lifecycle, 100, 1, 'Milk', deps({ addStock }))).rejects.toBeInstanceOf(UncertainWriteError);
    setLifecycleStatus(lifecycle.id, 'blocked');

    const result = await reconcileCheckLifecycles(new Set(['row-2']), deps({ addStock, findStockLogRows }));
    expect(result.stillUnknown).toBe(1);
    expect(result.retryRequested).toEqual([]);
    await expect(bookCheckStock(lifecycle, 100, 1, 'Milk', deps({ addStock }))).rejects.toBeInstanceOf(UncertainWriteError);
    expect(addStock).toHaveBeenCalledTimes(1);
  });

  it('completes the lifecycle when verification finds the marker', async () => {
    const addStock = vi.fn().mockRejectedValue(new Error('socket hang up'));
    const lifecycle = openCheckLifecycle({ id: 'row-3', foodId: 'food' }, 100);
    await expect(bookCheckStock(lifecycle, 100, 1, 'Milk', deps({ addStock }))).rejects.toBeInstanceOf(UncertainWriteError);
    setLifecycleStatus(lifecycle.id, 'blocked');
    const [effect] = db.select().from(shopEffects).all();
    const findStockLogRows = vi.fn(async () => [{ id: 9, transaction_id: 'tx-9', note: `[gms:${effect.id}]`, undone: 0 }]);

    const result = await reconcileCheckLifecycles(new Set(['row-3']), deps({ findStockLogRows }));
    expect(result).toMatchObject({ verifiedApplied: 1, appliedProductIds: [100], completedItemIds: ['row-3'] });
    expect(getEffect(effect.id)).toMatchObject({ status: 'applied', externalRef: 'tx-9' });
    expect(db.select().from(checkLifecycles).where(eq(checkLifecycles.id, lifecycle.id)).get()?.status).toBe('completed');
    // Check bookings are guarded in memory by the caller, not through receipt accounting.
    expect(db.select().from(lowStockAccountedRestocks).all()).toEqual([]);
  });

  it('respects a booking the user undid in Grocy', async () => {
    const lifecycle = openCheckLifecycle({ id: 'row-4', foodId: 'food' }, 100);
    await expect(bookCheckStock(lifecycle, 100, 1, 'Milk', deps({ addStock: vi.fn().mockRejectedValue(apiError(504)) }))).rejects.toBeInstanceOf(UncertainWriteError);
    setLifecycleStatus(lifecycle.id, 'blocked');
    const [effect] = db.select().from(shopEffects).all();
    const findStockLogRows = vi.fn(async () => [{ id: 9, transaction_id: 'tx-9', note: `[gms:${effect.id}]`, undone: 1 }]);
    await reconcileCheckLifecycles(new Set(['row-4']), deps({ findStockLogRows }));
    expect(getEffect(effect.id)?.status).toBe('applied');
    expect(getEffect(effect.id)?.evidence).toMatchObject({ undoneByUser: true });
  });

  it('retries only after the user says the booking did not happen', async () => {
    const addStock = vi.fn().mockRejectedValueOnce(apiError(500)).mockResolvedValueOnce([{ id: 3, transaction_id: 'tx-3' }]);
    const lifecycle = openCheckLifecycle({ id: 'row-5', foodId: 'food' }, 100);
    await expect(bookCheckStock(lifecycle, 100, 2, 'Milk', deps({ addStock }))).rejects.toBeInstanceOf(UncertainWriteError);
    setLifecycleStatus(lifecycle.id, 'blocked');
    const [effect] = db.select().from(shopEffects).all();

    expect(resolveUnknownEffect(effect.id, { action: 'not_booked_retry' })).toBe(true);
    const result = await reconcileCheckLifecycles(new Set(['row-5']), deps({ addStock }));
    expect(result.retryRequested).toEqual(['row-5']);
    const reopened = openCheckLifecycle({ id: 'row-5', foodId: 'food' }, 100);
    expect(reopened.id).toBe(lifecycle.id);
    expect(await bookCheckStock(reopened, 100, 2, 'Milk', deps({ addStock }))).toBe('applied');
    expect(addStock).toHaveBeenCalledTimes(2);
  });

  it('runs the manual-check guard when the user confirms a booking happened elsewhere', async () => {
    db.insert(syncState).values({ id: 'singleton', stateData: JSON.stringify({ syncRestockedProducts: {} }) }).run();
    const lifecycle = openCheckLifecycle({ id: 'row-6', foodId: 'food' }, 100);
    await expect(bookCheckStock(lifecycle, 100, 1, 'Milk', deps({ addStock: vi.fn().mockRejectedValue(apiError(503)) }))).rejects.toBeInstanceOf(UncertainWriteError);
    const [effect] = db.select().from(shopEffects).all();

    expect(resolveUnknownEffect(effect.id, { action: 'booked_elsewhere', transactionId: 'tx-manual' })).toBe(true);
    expect(resolveUnknownEffect(effect.id, { action: 'booked_elsewhere' })).toBe(false);
    const state = JSON.parse(db.select().from(syncState).get()!.stateData);
    expect(Object.keys(state.syncRestockedProducts)).toEqual(['100']);
  });

  it('records receipt accounting exactly once when a receipt booking is confirmed by the user', () => {
    const effect = ensureEffect<GrocyAddPayload>({ effectKey: 'receipt-line', kind: 'grocy_add', sourceKind: 'receipt', sourceRef: 'receipt', payload: { productId: 7, amount: 3 } });
    beginAttempt(effect.id);
    recoverInterruptedEffects();
    expect(resolveUnknownEffect(effect.id, { action: 'booked_elsewhere' })).toBe(true);
    expect(resolveUnknownEffect(effect.id, { action: 'booked_elsewhere' })).toBe(false);
    expect(db.select().from(lowStockAccountedRestocks).all()).toHaveLength(1);
  });
});

describe('check booking versions and legacy bookings', () => {
  function legacyBooking(itemId: string, productId: number, amount: number, status: 'planned' | 'not_applied') {
    const lifecycle = openCheckLifecycle({ id: itemId, foodId: 'food' }, productId);
    const effect = ensureEffect<GrocyAddPayload>({
      effectKey: `check:${lifecycle.id}:grocy_add:${productId}`, kind: 'grocy_add', sourceKind: 'check', sourceRef: lifecycle.id,
      payload: { productId, amount, label: 'Chickpeas' },
    });
    if (status === 'not_applied') db.update(shopEffects).set({ status: 'not_applied' }).where(eq(shopEffects.id, effect.id)).run();
    setLifecycleStatus(lifecycle.id, 'failed');
    return { lifecycle, effect };
  }

  it('stores the payload version and conversion with every new booking', async () => {
    const lifecycle = openCheckLifecycle({ id: 'row-v', foodId: 'food' }, 58);
    const conversion = { mealieQuantity: 400, mealieUnitId: 'gram', mealieUnitName: 'gram', factor: 0.0025 };
    expect(await bookCheckStock(lifecycle, 58, 1, 'Chickpeas', deps(), conversion)).toBe('applied');
    expect(getLifecycleBookings(lifecycle.id)).toEqual([
      expect.objectContaining({ productId: 58, amount: 1, version: 2, conversion, label: 'Chickpeas' }),
    ]);
  });

  it('reports a cancelled booking as cancelled, never as booked', async () => {
    const addStock = vi.fn(async () => [{ id: 1, transaction_id: 'tx-1' }]);
    const lifecycle = openCheckLifecycle({ id: 'row-c', foodId: 'food' }, 58);
    const effect = ensureEffect<GrocyAddPayload>({
      effectKey: `check:${lifecycle.id}:grocy_add:58`, kind: 'grocy_add', sourceKind: 'check', sourceRef: lifecycle.id, payload: { productId: 58, amount: 1, v: 2 },
    });
    db.update(shopEffects).set({ status: 'cancelled' }).where(eq(shopEffects.id, effect.id)).run();
    expect(await bookCheckStock(lifecycle, 58, 1, 'Chickpeas', deps({ addStock }))).toBe('cancelled');
    expect(addStock).not.toHaveBeenCalled();
  });

  it('cancels unbooked legacy bookings of a normal row and closes their lifecycle', () => {
    const { lifecycle, effect } = legacyBooking('row-l', 58, 400, 'not_applied');
    expect(retireLegacyCheckLifecycle('row-l')).toEqual([expect.objectContaining({ effectId: effect.id, amount: 400, version: null })]);
    expect(getEffect(effect.id)?.status).toBe('cancelled');
    expect(findOpenLifecycle('row-l')).toBeNull();
    expect(db.select().from(checkLifecycles).where(eq(checkLifecycles.id, lifecycle.id)).get()).toMatchObject({ status: 'cancelled', closedReason: 'legacy_amount' });
    // A new check starts a fresh lifecycle and booking.
    expect(openCheckLifecycle({ id: 'row-l', foodId: 'food' }, 58).id).not.toBe(lifecycle.id);
    expect(retireLegacyCheckLifecycle('row-l')).toEqual([]);
  });

  it('keeps the cancellation over later reconciliation runs', async () => {
    legacyBooking('row-r', 58, 400, 'planned');
    retireLegacyCheckLifecycle('row-r');
    for (let run = 0; run < 3; run++) {
      const result = await reconcileCheckLifecycles(new Set(['row-r']), deps());
      expect(result.retryRequested).not.toContain('row-r');
    }
    expect(findOpenLifecycle('row-r')).toBeNull();
  });

  it('leaves lifecycles with applied, uncertain or current-version bookings alone', async () => {
    const applied = openCheckLifecycle({ id: 'row-a', foodId: 'food' }, 58);
    const appliedEffect = ensureEffect<GrocyAddPayload>({
      effectKey: `check:${applied.id}:grocy_add:58`, kind: 'grocy_add', sourceKind: 'check', sourceRef: applied.id, payload: { productId: 58, amount: 1 },
    });
    db.update(shopEffects).set({ status: 'applied' }).where(eq(shopEffects.id, appliedEffect.id)).run();
    expect(retireLegacyCheckLifecycle('row-a')).toEqual([]);

    const uncertain = openCheckLifecycle({ id: 'row-u', foodId: 'food' }, 58);
    const uncertainEffect = ensureEffect<GrocyAddPayload>({
      effectKey: `check:${uncertain.id}:grocy_add:58`, kind: 'grocy_add', sourceKind: 'check', sourceRef: uncertain.id, payload: { productId: 58, amount: 400 },
    });
    db.update(shopEffects).set({ status: 'unknown' }).where(eq(shopEffects.id, uncertainEffect.id)).run();
    expect(retireLegacyCheckLifecycle('row-u')).toEqual([]);
    expect(getEffect(uncertainEffect.id)?.status).toBe('unknown');

    const current = openCheckLifecycle({ id: 'row-n', foodId: 'food' }, 58);
    await expect(bookCheckStock(current, 58, 1, 'Chickpeas', deps({ addStock: vi.fn().mockRejectedValue(apiError(400)) }))).rejects.toMatchObject({ status: 400 });
    expect(retireLegacyCheckLifecycle('row-n')).toEqual([]);
  });

  it('keeps a legacy lifecycle that has a review, so its decision still applies', () => {
    const { lifecycle, effect } = legacyBooking('row-d', 58, 1, 'planned');
    db.insert(discrepancies).values({
      id: 'disc-1', kind: 'check_after_receipt', status: 'resolved', resolution: 'book_check', receiptLineId: null,
      lifecycleId: lifecycle.id, evidenceJson: '{}', createdAt: new Date(),
    }).run();
    expect(retireLegacyCheckLifecycle('row-d')).toEqual([]);
    expect(getEffect(effect.id)?.status).toBe('planned');
  });

  it('lets an unchecked row drop its pending legacy booking as before', () => {
    const { effect } = legacyBooking('row-x', 58, 400, 'planned');
    handleUncheckedItem('row-x');
    expect(getEffect(effect.id)?.status).toBe('cancelled');
  });
});

describe('reconciliation of partly cancelled checks', () => {
  async function uncertainBooking(lifecycle: { id: string }, productId: number) {
    await expect(bookCheckStock(lifecycle, productId, 1, `Product ${productId}`, deps({ addStock: vi.fn().mockRejectedValue(apiError(502)) })))
      .rejects.toBeInstanceOf(UncertainWriteError);
    return getLifecycleBookings(lifecycle.id).find(booking => booking.productId === productId)!;
  }

  it('does not report a skipped uncertain booking as a fulfilled row', async () => {
    const lifecycle = openCheckLifecycle({ id: 'row-s', foodId: 'food' }, 58);
    const booking = await uncertainBooking(lifecycle, 58);
    setLifecycleStatus(lifecycle.id, 'blocked');
    expect(resolveUnknownEffect(booking.effectId, { action: 'skip' })).toBe(true);

    const result = await reconcileCheckLifecycles(new Set(['row-s']), deps());

    expect(result.completedItemIds).not.toContain('row-s');
    expect(db.select().from(checkLifecycles).where(eq(checkLifecycles.id, lifecycle.id)).get()?.status).toBe('skipped');
  });

  it('keeps a lifecycle with an applied and a skipped child completed, without syncing the row', async () => {
    const lifecycle = openCheckLifecycle({ id: 'row-m', foodId: 'food' }, 100);
    expect(await bookCheckStock(lifecycle, 201, 2, 'Child A', deps())).toBe('applied');
    const uncertain = await uncertainBooking(lifecycle, 202);
    setLifecycleStatus(lifecycle.id, 'blocked');
    expect(resolveUnknownEffect(uncertain.effectId, { action: 'skip' })).toBe(true);

    const result = await reconcileCheckLifecycles(new Set(['row-m']), deps());

    expect(result.completedItemIds).not.toContain('row-m');
    expect(db.select().from(checkLifecycles).where(eq(checkLifecycles.id, lifecycle.id)).get()?.status).toBe('completed');
  });
});

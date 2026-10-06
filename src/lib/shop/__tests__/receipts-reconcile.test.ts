import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { createTestDb } = await import('@/test-utils/test-db');
  return { db: createTestDb() };
});

import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import type { MealieShoppingItem } from '@/lib/mealie/types';
import {
  createInstallation,
  getInstallation,
  recordHello,
  resetInstallationBinding,
  updateInstallationSettings,
} from '@/lib/plugins/installations';
import type { HelloParams, Receipt } from '@/lib/plugins/protocol/v1';
import { bookCheckStock, guardReceiptFulfillment, openCheckLifecycle, setLifecycleStatus } from '../check-lifecycles';
import { observeDemand } from '../demand-observer';
import { listDiscrepancies, resolveDiscrepancy, substituteReceiptLine } from '../discrepancies';
import { defaultEffectRunnerDeps, type EffectRunnerDeps } from '../effect-runners';
import { CheckDeferredError, ensureLedgerActivated, listEffects } from '../ledger';
import { resetListOwnership } from '../list-sync';
import { persistExports } from '../projection';
import { getReceiptLines, listReceipts, pullReceipts, type ReceiptPullDeps } from '../receipts';
import { runShopReconcile } from '../reconcile-executor';
import { upsertRetailerMapping, upsertRetailerProducts } from '../retailer-catalog';
import { emptyUnitContext } from '../units';

const PURCHASED = '2026-10-05T10:00:00.000Z';

function hello(overrides: Partial<HelloParams> = {}): HelloParams {
  return {
    pluginName: 'Demo', pluginVersion: '1.0.0', providerId: 'demo-shop', providerLabel: 'Demo shop',
    accountKey: 'demo-account', accountLabel: 'Demo', protocolVersions: [1], capabilities: ['auth', 'catalog', 'list', 'receipts'],
    authState: 'authenticated', ...overrides,
  };
}

function receipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    receiptId: 'r-1',
    purchasedAt: PURCHASED,
    lines: [
      { lineNo: 1, kind: 'product', retailerProductId: 'milk', description: 'Milk 1 L', quantity: 2, unit: 'st', amountCents: 238 },
      { lineNo: 2, kind: 'deposit', description: 'Deposit', quantity: 1, unit: 'st', amountCents: 15 },
      { lineNo: 3, kind: 'product', retailerProductId: 'mystery', description: 'Mystery item', quantity: 1, unit: 'st', amountCents: 99 },
    ],
    ...overrides,
  };
}

function setupInstallation(name = 'Demo', activatedAt = new Date('2026-10-01T00:00:00Z')) {
  ensureLedgerActivated(new Date('2026-09-01T00:00:00Z'));
  const { installation } = createInstallation(name);
  recordHello(installation.id, hello());
  updateInstallationSettings(installation.id, { receiptsEnabled: true, listSyncEnabled: true, grocyShoppingLocationId: 4 }, { now: activatedAt });
  return getInstallation(installation.id)!;
}

function pullDeps(receipts: Receipt[], overrides: Partial<ReceiptPullDeps> = {}): ReceiptPullDeps {
  return {
    listReceipts: vi.fn(async () => ({ receipts: receipts.map(entry => ({ receiptId: entry.receiptId, purchasedAt: entry.purchasedAt, lineCount: entry.lines.length })), nextCursor: null })),
    getReceipt: vi.fn(async (id: string) => receipts.find(entry => entry.receiptId === id)!),
    now: () => new Date('2026-10-06T10:00:00Z'),
    ...overrides,
  };
}

function row(overrides: Partial<MealieShoppingItem> = {}): MealieShoppingItem {
  return { id: 'row-milk', shoppingListId: 'list', groupId: 'g', householdId: 'h', checked: false, quantity: 3, foodId: 'food-milk', unitId: null, note: null, display: 'Milk', ...overrides } as MealieShoppingItem;
}

function unitContext() {
  const ctx = emptyUnitContext();
  ctx.grocyProducts.set(1, { id: 1, name: 'Milk', quIdStock: 10, quIdPurchase: 10, parentProductId: null, noOwnStock: false });
  ctx.foodToGrocyProduct.set('food-milk', 1);
  return ctx;
}

function runner(items: { current: MealieShoppingItem[] }, overrides: Partial<EffectRunnerDeps> = {}): EffectRunnerDeps {
  return {
    ...defaultEffectRunnerDeps,
    addStock: vi.fn(async () => [{ id: 1, transaction_id: 'tx-receipt' }]),
    findStockLogRows: vi.fn(async () => []),
    getMealieItem: vi.fn(async (id: string) => items.current.find(item => item.id === id) ?? null),
    updateMealieItem: vi.fn(async (id: string, body: { quantity?: number }) => {
      items.current = items.current.map(item => (item.id === id ? { ...item, quantity: body.quantity } : item));
    }),
    deleteMealieItem: vi.fn(async (id: string) => {
      items.current = items.current.filter(item => item.id !== id);
    }),
    now: () => new Date('2026-10-06T12:00:00Z'),
    ...overrides,
  };
}

function reconcileDeps(items: { current: MealieShoppingItem[] }, run: EffectRunnerDeps) {
  return {
    runner: run,
    shoppingListId: 'list',
    loadMealieItems: async () => items.current,
    loadUnitContext: async () => unitContext(),
    observationGraceMs: 120_000,
    now: () => new Date('2026-10-06T12:00:00Z'),
  };
}

function mapMilk(installationProvider = 'demo-shop') {
  upsertRetailerProducts(installationProvider, [{ id: 'milk', name: 'Milk 1 L', packageAmount: 1, packageUnit: 'l', measure: 'unit' }]);
  upsertRetailerMapping({
    providerId: installationProvider, retailerProductId: 'milk', targetKind: 'grocy_product', targetId: '1', targetName: 'Milk',
    role: 'preferred', baseUnitId: '10', baseUnitName: 'Liter', packageBaseAmount: 1, confirm: true,
  });
}

function exportRow(installationId: string, revisionId: string, createdAt: Date, quantity = 3) {
  persistExports(installationId, 'demo-shop', [{
    retailerProductId: 'milk', packages: quantity, baseAmount: quantity,
    allocations: [{ revisionId, mealieItemId: 'row-milk', targetKind: 'grocy_product', targetId: '1', baseAmount: quantity, rowFactor: 1 }],
  }], createdAt);
}

beforeEach(() => {
  for (const table of Object.values(schema)) {
    if (table && typeof table === 'object' && Symbol.for('drizzle:Name') in (table as object)) db.delete(table as typeof schema.receipts).run();
  }
});

describe('receipt pulls', () => {
  it('stores receipts once per retailer account and keeps old ones as headers', async () => {
    const first = setupInstallation('First');
    const second = setupInstallation('Second');
    const old = receipt({ receiptId: 'old', purchasedAt: '2026-09-20T10:00:00.000Z' });
    expect(await pullReceipts(first, pullDeps([receipt(), old]))).toMatchObject({ stored: 1, ignored: 1 });
    expect(await pullReceipts(second, pullDeps([receipt()]))).toMatchObject({ stored: 0 });
    const stored = listReceipts();
    expect(stored.map(entry => [entry.externalReceiptId, entry.status])).toEqual([['old', 'ignored_before_activation'], ['r-1', 'stored']]);
    expect(getReceiptLines(stored[0].id)).toEqual([]);
    expect(getReceiptLines(stored[1].id).map(line => line.status)).toEqual(['pending', 'ignored', 'pending']);
  });

  it('re-fetches receipts in the overlap window and flags content changes', async () => {
    const installation = setupInstallation();
    await pullReceipts(installation, pullDeps([receipt()]));
    const changed = receipt();
    changed.lines[0] = { ...changed.lines[0], quantity: 3 };
    expect(await pullReceipts(installation, pullDeps([changed]))).toMatchObject({ changed: 1 });
    expect(listReceipts()[0].status).toBe('changed');
  });

  it('does not advance the high-water mark while pages remain', async () => {
    const installation = setupInstallation();
    let calls = 0;
    const deps = pullDeps([receipt()], {
      listReceipts: vi.fn(async () => {
        calls++;
        return { receipts: [{ receiptId: `p-${calls}`, purchasedAt: PURCHASED, lineCount: 0 }], nextCursor: `page-${calls}` };
      }),
      getReceipt: vi.fn(async (id: string) => ({ receiptId: id, purchasedAt: PURCHASED, lines: [] })),
    });
    const result = await pullReceipts(installation, deps);
    expect(result.message).toMatch(/continues/);
    const cursor = db.select().from(schema.receiptCursors).get()!;
    expect(cursor.pageCursor).toBe('page-50');
    expect(cursor.sinceAt).toBeNull();
  });
});

describe('receipt reconciliation', () => {
  it('books the purchase once, reduces the row and records low-stock accounting', async () => {
    const installation = setupInstallation();
    mapMilk();
    observeDemand('list', [row()], new Date('2026-10-04T10:00:00Z'));
    const revisionId = db.select().from(schema.demandRevisions).get()!.id;
    exportRow(installation.id, revisionId, new Date('2026-10-04T10:00:00Z'));
    await pullReceipts(installation, pullDeps([receipt()]));

    const items = { current: [row()] };
    const run = runner(items);
    const result = await runShopReconcile(reconcileDeps(items, run));
    expect(result.summary).toMatchObject({ planned: 1, reviewReceipts: 1 });
    expect(run.addStock).toHaveBeenCalledTimes(1);
    expect(run.addStock).toHaveBeenCalledWith(1, expect.objectContaining({ amount: 2, price: 1.19, shoppingLocationId: 4, note: expect.stringMatching(/^\[gms:/) }));
    expect(items.current).toEqual([expect.objectContaining({ quantity: 1 })]);
    expect(db.select().from(schema.lowStockAccountedRestocks).all()).toEqual([expect.objectContaining({ grocyProductId: 1, stockAmount: 2 })]);
    const lines = getReceiptLines(listReceipts()[0].id);
    expect(lines.map(line => [line.status, line.reviewReason])).toEqual([['planned', null], ['ignored', null], ['review', 'mapping_missing']]);

    await runShopReconcile(reconcileDeps(items, run));
    expect(run.addStock).toHaveBeenCalledTimes(1);
  });

  it('never books with an amount confirmed for a different stock unit', async () => {
    const installation = setupInstallation();
    mapMilk();
    await pullReceipts(installation, pullDeps([receipt({ lines: [receipt().lines[0]] })]));
    const items = { current: [] as MealieShoppingItem[] };
    const run = runner(items);
    const deps = reconcileDeps(items, run);
    // Grocy's stock unit for the product changed from liter (10) to milliliter (12).
    deps.loadUnitContext = async () => {
      const ctx = unitContext();
      ctx.grocyProducts.set(1, { ...ctx.grocyProducts.get(1)!, quIdStock: 12 });
      return ctx;
    };
    await runShopReconcile(deps);
    expect(run.addStock).not.toHaveBeenCalled();
    expect(getReceiptLines(listReceipts()[0].id)[0]).toMatchObject({ status: 'review', reviewReason: 'mapping_unit_changed' });
  });

  it('credits a manual check of an exported row instead of booking again', async () => {
    const installation = setupInstallation();
    mapMilk();
    observeDemand('list', [row({ quantity: 2 })], new Date('2026-10-04T10:00:00Z'));
    const revisionId = db.select().from(schema.demandRevisions).get()!.id;
    exportRow(installation.id, revisionId, new Date('2026-10-04T10:00:00Z'), 2);
    const lifecycle = openCheckLifecycle({ id: 'row-milk', foodId: 'food-milk', quantity: 2 }, 1, new Date('2026-10-05T09:55:00Z'));
    await bookCheckStock(lifecycle, 1, 2, 'Milk', { addStock: vi.fn(async () => [{ id: 5, transaction_id: 'tx-check' }]) });
    setLifecycleStatus(lifecycle.id, 'completed');
    await pullReceipts(installation, pullDeps([receipt({ lines: [receipt().lines[0]] })]));

    const items = { current: [] as MealieShoppingItem[] };
    const run = runner(items);
    await runShopReconcile(reconcileDeps(items, run));
    expect(run.addStock).not.toHaveBeenCalled();
    expect(db.select().from(schema.reconciliationLinks).all()).toEqual([expect.objectContaining({ kind: 'credit', lifecycleId: lifecycle.id, baseAmount: 2 })]);
    expect(listReceipts()[0].status).toBe('processed');
  });

  it('flags a manual check that booked more than the receipt shows', async () => {
    const installation = setupInstallation();
    mapMilk();
    observeDemand('list', [row({ quantity: 5 })], new Date('2026-10-04T10:00:00Z'));
    exportRow(installation.id, db.select().from(schema.demandRevisions).get()!.id, new Date('2026-10-04T10:00:00Z'), 5);
    const lifecycle = openCheckLifecycle({ id: 'row-milk', foodId: 'food-milk', quantity: 5 }, 1, new Date('2026-10-05T09:55:00Z'));
    await bookCheckStock(lifecycle, 1, 5, 'Milk', { addStock: vi.fn(async () => [{ id: 5, transaction_id: 'tx-check' }]) });
    setLifecycleStatus(lifecycle.id, 'completed');
    await pullReceipts(installation, pullDeps([receipt({ lines: [receipt().lines[0]] })]));

    const items = { current: [] as MealieShoppingItem[] };
    await runShopReconcile(reconcileDeps(items, runner(items)));
    const [discrepancy] = listDiscrepancies();
    expect(discrepancy).toMatchObject({ kind: 'over_booked_manual_check', lifecycleId: lifecycle.id });
    expect(JSON.parse(discrepancy.evidenceJson)).toMatchObject({ bookedAmount: 5, receiptAmount: 2, bookings: [expect.objectContaining({ transactionId: 'tx-check' })] });

    const consume = vi.fn(async () => [{ id: 9, transaction_id: 'tx-consume' }]);
    expect(await resolveDiscrepancy(discrepancy.id, { action: 'consume_difference', productId: 1, amount: 3 }, { ...defaultEffectRunnerDeps, consumeStock: consume }))
      .toMatchObject({ status: 'resolved' });
    expect(consume).toHaveBeenCalledWith(1, 3);
  });

  it('keeps the reduction waiting while the booking is unknown', async () => {
    const installation = setupInstallation();
    mapMilk();
    observeDemand('list', [row()], new Date('2026-10-04T10:00:00Z'));
    exportRow(installation.id, db.select().from(schema.demandRevisions).get()!.id, new Date('2026-10-04T10:00:00Z'));
    await pullReceipts(installation, pullDeps([receipt({ lines: [receipt().lines[0]] })]));
    const items = { current: [row()] };
    const run = runner(items, { addStock: vi.fn().mockRejectedValue(Object.assign(new Error('Bad gateway'), { status: 502 })) });
    await runShopReconcile(reconcileDeps(items, run));
    await runShopReconcile(reconcileDeps(items, run));
    expect(run.addStock).toHaveBeenCalledTimes(1);
    expect(run.updateMealieItem).not.toHaveBeenCalled();
    expect(listEffects({ kinds: ['mealie_reduce'] })[0].status).toBe('planned');
    expect(db.select().from(schema.lowStockAccountedRestocks).all()).toEqual([]);
  });

  it('blocks a manual check of a row whose receipt reduction is not settled', async () => {
    const installation = setupInstallation();
    mapMilk();
    observeDemand('list', [row()], new Date('2026-10-04T10:00:00Z'));
    exportRow(installation.id, db.select().from(schema.demandRevisions).get()!.id, new Date('2026-10-04T10:00:00Z'));
    await pullReceipts(installation, pullDeps([receipt({ lines: [receipt().lines[0]] })]));
    const items = { current: [row()] };
    const run = runner(items, { updateMealieItem: vi.fn().mockRejectedValue(Object.assign(new Error('timeout'), { status: 504 })) });
    await runShopReconcile(reconcileDeps(items, run));
    expect(run.addStock).toHaveBeenCalledTimes(1);
    expect(listEffects({ kinds: ['mealie_reduce'] })[0].status).toBe('unknown');

    // The user checks the still-visible row before the next poll.
    const lifecycle = openCheckLifecycle({ id: 'row-milk', foodId: 'food-milk', quantity: 3 }, 1);
    expect(() => guardReceiptFulfillment(lifecycle.id, 'row-milk')).toThrow(CheckDeferredError);
    const [discrepancy] = listDiscrepancies();
    expect(discrepancy).toMatchObject({ kind: 'check_after_receipt', lifecycleId: lifecycle.id });

    expect(await resolveDiscrepancy(discrepancy.id, { action: 'book_check' })).toMatchObject({ status: 'resolved' });
    expect(() => guardReceiptFulfillment(lifecycle.id, 'row-milk')).not.toThrow();
  });

  it('confirms a one-off substitution and flags an original already booked by a check', async () => {
    const installation = setupInstallation();
    await pullReceipts(installation, pullDeps([receipt({ lines: [receipt().lines[2]] })]));
    const items = { current: [row({ id: 'row-other', foodId: 'food-other' })] };
    await runShopReconcile(reconcileDeps(items, runner(items)));
    const [line] = getReceiptLines(listReceipts()[0].id);
    expect(line.status).toBe('review');

    const lifecycle = openCheckLifecycle({ id: 'row-checked', foodId: 'food-milk' }, 1);
    await bookCheckStock(lifecycle, 1, 1, 'Milk', { addStock: vi.fn(async () => [{ id: 3, transaction_id: 'tx-original' }]) });
    setLifecycleStatus(lifecycle.id, 'completed');
    const result = substituteReceiptLine({
      receiptLineId: line.id, bookGrocyProductId: 2, bookGrocyProductName: 'Oat milk', stockAmount: 1,
      mealieItemIds: ['row-other'], lifecycleIds: [lifecycle.id], rememberAsAlternative: false, shoppingListId: 'list',
    }, items.current);
    expect(result).toMatchObject({ ok: true, discrepancies: 1 });
    expect(db.select().from(schema.retailerMappings).all()).toEqual([]);

    const run = runner(items);
    await runShopReconcile(reconcileDeps(items, run));
    expect(run.addStock).toHaveBeenCalledWith(2, expect.objectContaining({ amount: 1 }));
    expect(items.current).toEqual([]);
    expect(listDiscrepancies()).toEqual([expect.objectContaining({ kind: 'substitution_original_booked' })]);
  });
});

describe('binding reset', () => {
  it('disables automation and moves the receipt boundary forward when re-enabled', () => {
    const installation = setupInstallation();
    resetInstallationBinding(installation.id);
    const reset = getInstallation(installation.id)!;
    expect(reset.settings).toMatchObject({ receiptsEnabled: false, listSyncEnabled: false, boundAccountKey: null, pinnedListId: null });
    updateInstallationSettings(installation.id, { receiptsEnabled: true }, { now: new Date('2026-11-01T00:00:00Z') });
    expect(getInstallation(installation.id)!.settings.receiptsActivatedAt).toBe('2026-11-01T00:00:00.000Z');
  });

  it('refuses a reset while the list lease is held', () => {
    const installation = setupInstallation();
    db.insert(schema.runtimeLocks).values({ name: `shop-list:${installation.id}`, ownerId: 'someone-else', expiresAt: Date.now() + 60_000 }).run();
    expect(resetListOwnership(installation.id)).toBe('busy');
  });

  it('rejects a different retailer account until the binding is reset', () => {
    const installation = setupInstallation();
    expect(recordHello(installation.id, hello({ accountKey: 'another-account' }))).toMatchObject({ ok: false });
    resetInstallationBinding(installation.id);
    expect(recordHello(installation.id, hello({ accountKey: 'another-account' }))).toMatchObject({ ok: true });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { createTestDb } = await import('@/test-utils/test-db');
  return { db: createTestDb() };
});

import { db } from '@/lib/db';
import { appMeta, demandRevisions, demands, pluginInstallations, runtimeLocks, shopExportAllocations, shopExports, shopListLines } from '@/lib/db/schema';
import type { MealieShoppingItem } from '@/lib/mealie/types';
import { createInstallation } from '@/lib/plugins/installations';
import { PluginCallError } from '@/lib/plugins/gateway';
import type { ListApplyParams, ListApplyResult, ShopList } from '@/lib/plugins/protocol/v1';
import { listOpenDemand, observeDemand } from '../demand-observer';
import { planListSync, resolvePausedLine, validateApplyResults, type DesiredLine, type LineRecord } from '../list-ownership';
import { getPendingListApply, resolvePausedListLine, syncInstallationList } from '../list-sync';
import { listActiveExports, persistExports, projectDemand, targetKey, type ProjectionDemand, type ProjectionMapping } from '../projection';
import { emptyUnitContext, mealieQuantityToGrocyStock, type UnitContext } from '../units';

function item(overrides: Partial<MealieShoppingItem> = {}): MealieShoppingItem {
  return { id: 'row-1', shoppingListId: 'list', groupId: 'g', householdId: 'h', checked: false, quantity: 1, foodId: 'food-milk', note: null, display: 'Milk', ...overrides } as MealieShoppingItem;
}

beforeEach(() => {
  for (const table of [demands, demandRevisions, shopExports, shopExportAllocations, shopListLines, appMeta, pluginInstallations, runtimeLocks]) db.delete(table).run();
});

describe('demand observation', () => {
  it('records revisions, checks and removals without implying purchases', () => {
    const t0 = new Date('2026-10-01T10:00:00Z');
    expect(observeDemand('list', [item({ quantity: 2 }), item({ id: 'row-2', foodId: 'food-rice' })], t0)).toMatchObject({ created: 2 });
    expect(observeDemand('list', [item({ quantity: 3 }), item({ id: 'row-2', foodId: 'food-rice' })], new Date('2026-10-01T10:01:00Z'))).toMatchObject({ revised: 1 });
    expect(observeDemand('list', [item({ quantity: 3, checked: true })], new Date('2026-10-01T10:02:00Z'))).toMatchObject({ checked: 1, removed: 1 });

    const rows = new Map(db.select().from(demands).all().map(row => [row.mealieItemId, row]));
    expect(rows.get('row-1')).toMatchObject({ status: 'checked' });
    expect(rows.get('row-2')).toMatchObject({ status: 'removed' });
    expect(db.select().from(demandRevisions).all().filter(row => row.mealieItemId === 'row-1').map(row => row.quantity)).toEqual([2, 3, 3]);
    expect(listOpenDemand('list')).toEqual([]);
  });

  it('treats a re-added row as new demand', () => {
    observeDemand('list', [item()], new Date('2026-10-01T10:00:00Z'));
    observeDemand('list', [], new Date('2026-10-01T10:01:00Z'));
    observeDemand('list', [item({ id: 'row-new' })], new Date('2026-10-01T10:02:00Z'));
    expect(listOpenDemand('list').map(entry => entry.demand.mealieItemId)).toEqual(['row-new']);
  });
});

function ctx(): UnitContext {
  const context = emptyUnitContext();
  context.grocyProducts.set(1, { id: 1, name: 'Milk', quIdStock: 10, quIdPurchase: 10, parentProductId: null, noOwnStock: false });
  context.grocyProducts.set(2, { id: 2, name: 'Flour', quIdStock: 20, quIdPurchase: 21, parentProductId: null, noOwnStock: false });
  context.grocyProducts.set(3, { id: 3, name: 'Whole milk', quIdStock: 10, quIdPurchase: 10, parentProductId: 1, noOwnStock: false });
  context.unitMappings.set('m-liter', { grocyUnitId: 10, factor: 1 });
  context.unitMappings.set('m-pack', { grocyUnitId: 21, factor: 1 });
  context.unitMappings.set('m-ml', { grocyUnitId: 30, factor: 1 });
  context.grocyConversions.push({ fromQuId: 30, toQuId: 10, factor: 0.001, productId: null });
  context.foodToGrocyProduct.set('food-milk', 1);
  context.foodToGrocyProduct.set('food-flour', 2);
  context.mealieUnits.set('m-g', { id: 'm-g', name: 'gram', abbreviation: 'g', standardUnit: 'gram', standardQuantity: 1 });
  context.mealieUnits.set('m-kg', { id: 'm-kg', name: 'kilogram', abbreviation: 'kg', standardUnit: 'kilogram', standardQuantity: 1 });
  return context;
}

function demand(overrides: Partial<ProjectionDemand>): ProjectionDemand {
  return { revisionId: 'rev', mealieItemId: 'row', foodId: 'food-milk', unitId: 'm-liter', quantity: 1, subItems: null, label: 'Milk', ...overrides };
}

const milkMapping: ProjectionMapping = { retailerProductId: 'ah-milk', targetKind: 'grocy_product', targetId: '1', packageBaseAmount: 1, packageBaseUnitId: '10', confirmed: true };

describe('projection', () => {
  it('sums compatible demand before rounding packages once', () => {
    const mappings = new Map([[targetKey('grocy_product', 1), { ...milkMapping, packageBaseAmount: 1.5 }]]);
    const { lines } = projectDemand([
      demand({ revisionId: 'a', mealieItemId: 'row-a', quantity: 0.5 }),
      demand({ revisionId: 'b', mealieItemId: 'row-b', unitId: 'm-ml', quantity: 700 }),
    ], mappings, ctx());
    // 0.5 l + 0.7 l = 1.2 l -> one 1.5 l package, not one per row.
    expect(lines).toEqual([expect.objectContaining({ retailerProductId: 'ah-milk', packages: 1 })]);
    expect(lines[0].allocations.map(allocation => allocation.baseAmount)).toEqual([0.5, expect.closeTo(0.7, 6)]);
  });

  it('requires a confirmed mapping and an unambiguous unit', () => {
    const unconfirmed = new Map([[targetKey('grocy_product', 1), { ...milkMapping, confirmed: false }]]);
    expect(projectDemand([demand({})], unconfirmed, ctx()).review).toEqual([expect.objectContaining({ reason: 'mapping_unconfirmed' })]);
    const flour = new Map([[targetKey('grocy_product', 2), { ...milkMapping, retailerProductId: 'ah-flour', targetId: '2', packageBaseUnitId: '20' }]]);
    expect(projectDemand([demand({ foodId: 'food-flour', unitId: 'm-pack' })], flour, ctx()).review)
      .toEqual([expect.objectContaining({ reason: 'purchase_unit_ambiguous' })]);
    expect(projectDemand([demand({ foodId: 'food-unknown' })], new Map(), ctx()).review)
      .toEqual([expect.objectContaining({ reason: 'no_retailer_mapping' })]);
  });

  it('sends a mapping to review when the Grocy stock unit changed after confirmation', () => {
    const changed = ctx();
    changed.grocyProducts.set(1, { ...changed.grocyProducts.get(1)!, quIdStock: 11 });
    const mappings = new Map([[targetKey('grocy_product', 1), milkMapping]]);
    expect(projectDemand([demand({})], mappings, changed)).toEqual({
      lines: [],
      review: [expect.objectContaining({ reason: 'mapping_unit_changed' })],
    });
    const gone = ctx();
    gone.grocyProducts.set(1, { ...gone.grocyProducts.get(1)!, noOwnStock: true });
    expect(projectDemand([demand({})], mappings, gone).review).toEqual([expect.objectContaining({ reason: 'mapping_unit_changed' })]);
    const mealieGone: ProjectionMapping = { retailerProductId: 'ah-basil', targetKind: 'mealie_food', targetId: 'food-basil', packageBaseAmount: 25, packageBaseUnitId: 'm-removed', confirmed: true };
    expect(projectDemand([demand({ foodId: 'food-basil', unitId: 'm-g' })], new Map([[targetKey('mealie_food', 'food-basil'), mealieGone]]), ctx()).review)
      .toEqual([expect.objectContaining({ reason: 'mapping_unit_changed' })]);
  });

  it('supports Mealie-only targets with standard unit conversion', () => {
    const mapping: ProjectionMapping = { retailerProductId: 'ah-basil', targetKind: 'mealie_food', targetId: 'food-basil', packageBaseAmount: 25, packageBaseUnitId: 'm-g', confirmed: true };
    const { lines } = projectDemand([demand({ foodId: 'food-basil', unitId: 'm-kg', quantity: 0.06 })], new Map([[targetKey('mealie_food', 'food-basil'), mapping]]), ctx());
    expect(lines[0]).toMatchObject({ packages: 3, baseAmount: expect.closeTo(60, 6) });
  });

  it('projects sub-product rows per child, falling back to the parent mapping', () => {
    const { lines } = projectDemand([
      demand({ subItems: [{ name: 'Whole milk', grocyProductId: 3, amount: 2 }] }),
    ], new Map([[targetKey('grocy_product', 1), milkMapping]]), ctx());
    expect(lines[0]).toMatchObject({ retailerProductId: 'ah-milk', packages: 2 });
  });

  it('keeps superseded export versions and only writes changed groups', () => {
    const line = { retailerProductId: 'ah-milk', packages: 2, baseAmount: 2, allocations: [{ revisionId: 'r1', mealieItemId: 'row', targetKind: 'grocy_product' as const, targetId: '1', baseAmount: 2, rowFactor: 1 }] };
    expect(persistExports('inst', 'demo', [line], new Date('2026-10-01T10:00:00Z'))).toEqual({ written: 1, superseded: 0 });
    expect(persistExports('inst', 'demo', [line], new Date('2026-10-01T10:01:00Z'))).toEqual({ written: 0, superseded: 0 });
    expect(persistExports('inst', 'demo', [{ ...line, packages: 3 }], new Date('2026-10-01T10:02:00Z'))).toEqual({ written: 1, superseded: 1 });
    expect(persistExports('inst', 'demo', [], new Date('2026-10-01T10:03:00Z'))).toEqual({ written: 0, superseded: 1 });
    expect(db.select().from(shopExports).all()).toHaveLength(2);
    expect(listActiveExports('inst')).toEqual([]);
  });

  it('reports purchase unit ambiguity instead of guessing', () => {
    expect(mealieQuantityToGrocyStock(ctx(), 2, 3, 'm-pack')).toEqual({ ok: false, reason: 'purchase_unit_ambiguous' });
    expect(mealieQuantityToGrocyStock(ctx(), 1, 500, 'm-ml')).toEqual({ ok: true, amount: 0.5, factor: 0.001 });
  });
});

function record(overrides: Partial<LineRecord>): LineRecord {
  return { retailerProductId: 'milk', kind: 'product', noteText: null, lineId: 'l1', managedQty: 2, baselineUserQty: 0, lastWrittenQty: 2, pausedReason: null, pausedObservedQty: null, releasedExportId: null, ...overrides };
}

function list(lines: ShopList['lines']): ShopList {
  return { listId: 'list', lines };
}

const want = (packages: number, exportId = 'export-1') => new Map<string, DesiredLine>([['milk', { packages, exportId }]]);

describe('shared list ownership', () => {
  it('adopts an existing user line as baseline and only adds our units', () => {
    const plan = planListSync([], want(2), list([{ lineId: 'l1', retailerProductId: 'milk', description: 'Milk', quantity: 1 }]));
    expect(plan.ops.map(op => op.op)).toEqual([{ op: 'set', lineId: 'l1', quantity: 3, expectedQuantity: 1 }]);
    expect(plan.ops[0].onApplied).toMatchObject({ baselineUserQty: 1, managedQty: 2, lastWrittenQty: 3 });
  });

  it('keeps units added by others and removes only ours', () => {
    const plan = planListSync([record({})], want(0), list([{ lineId: 'l1', retailerProductId: 'milk', description: 'Milk', quantity: 3 }]));
    expect(plan.ops.map(op => op.op)).toEqual([{ op: 'set', lineId: 'l1', quantity: 1, expectedQuantity: 3 }]);
    expect(plan.ops[0].onApplied).toBeNull();
  });

  it('pauses on any unexplained reduction or missing line', () => {
    expect(planListSync([record({})], want(2), list([{ lineId: 'l1', retailerProductId: 'milk', description: '', quantity: 1 }])).immediate)
      .toEqual([{ retailerProductId: 'milk', kind: 'product', record: expect.objectContaining({ pausedReason: 'reduced_by_other', pausedObservedQty: 1 }) }]);
    expect(planListSync([record({})], want(2), list([])).immediate)
      .toEqual([{ retailerProductId: 'milk', kind: 'product', record: expect.objectContaining({ pausedReason: 'line_missing' }) }]);
  });

  it('pauses instead of editing duplicate or reused lines', () => {
    const duplicates = list([
      { lineId: 'a', retailerProductId: 'milk', description: '', quantity: 1 },
      { lineId: 'b', retailerProductId: 'milk', description: '', quantity: 2 },
    ]);
    const fresh = planListSync([], want(1), duplicates);
    expect(fresh.ops).toEqual([]);
    expect(fresh.immediate[0].record).toMatchObject({ pausedReason: 'duplicate_lines', pausedObservedQty: 3 });
    const reused = planListSync([record({})], want(2), list([{ lineId: 'l1', retailerProductId: 'bread', description: '', quantity: 2 }]));
    expect(reused.ops).toEqual([]);
    expect(reused.immediate[0].record).toMatchObject({ pausedReason: 'line_reused' });
  });

  it('keeps a released line released until newer demand is exported', () => {
    const released = resolvePausedLine(record({ pausedReason: 'reduced_by_other', pausedObservedQty: 1 }), 'release', 'export-1');
    const current = list([{ lineId: 'l1', retailerProductId: 'milk', description: '', quantity: 1 }]);
    expect(planListSync([released], want(2, 'export-1'), current)).toEqual({ ops: [], immediate: [] });
    expect(planListSync([released], want(2, 'export-1'), current)).toEqual({ ops: [], immediate: [] });
    const renewed = planListSync([released], want(3, 'export-2'), current);
    expect(renewed.ops.map(op => op.op)).toEqual([{ op: 'set', lineId: 'l1', quantity: 4, expectedQuantity: 1 }]);
  });

  it('resolves pauses with explicit user explanations', () => {
    const paused = record({ managedQty: 2, baselineUserQty: 1, lastWrittenQty: 3, pausedReason: 'reduced_by_other', pausedObservedQty: 2 });
    expect(resolvePausedLine(paused, 'user_units_removed', null)).toMatchObject({ baselineUserQty: 0, lastWrittenQty: 2, pausedReason: null });
    expect(resolvePausedLine(paused, 'readd', null)).toMatchObject({ baselineUserQty: 1, lastWrittenQty: 2, pausedReason: null });
  });

  it('accepts only complete, unique per-op results', () => {
    expect(validateApplyResults(2, [{ index: 0, status: 'applied' }, { index: 1, status: 'failed' }])).toBe(true);
    expect(validateApplyResults(2, [{ index: 0, status: 'applied' }])).toBe(false);
    expect(validateApplyResults(2, [{ index: 0, status: 'applied' }, { index: 0, status: 'applied' }])).toBe(false);
  });
});

describe('list sync', () => {
  function exportMilk(installationId: string, packages: number) {
    persistExports(installationId, 'demo-shop', [{
      retailerProductId: 'milk', packages, baseAmount: packages,
      allocations: [{ revisionId: `rev-${packages}`, mealieItemId: 'row', targetKind: 'grocy_product', targetId: '1', baseAmount: packages, rowFactor: 1 }],
    }]);
  }

  function fakeShop(initial: ShopList) {
    const state = { list: structuredClone(initial), applied: new Map<string, ListApplyResult>() };
    const applyList = vi.fn(async (params: ListApplyParams): Promise<ListApplyResult> => {
      const cached = state.applied.get(params.opId);
      if (cached) return cached;
      const results = params.ops.map((op, index) => {
        if (op.op === 'add_note') {
          if (state.list.lines.some(line => line.retailerProductId === null && line.description.trim().toLowerCase() === op.text.trim().toLowerCase())) {
            return { index, status: 'conflict' as const, reason: 'note_exists' as const };
          }
          const lineId = `note-${state.list.lines.length + 1}`;
          state.list.lines.push({ lineId, retailerProductId: null, description: op.text, quantity: 1 });
          return { index, status: 'applied' as const, lineId };
        }
        if (op.op === 'remove_note') {
          const note = state.list.lines.find(candidate => candidate.lineId === op.lineId);
          if (!note || note.retailerProductId !== null || note.description !== op.expectedText) return { index, status: 'conflict' as const };
          state.list.lines = state.list.lines.filter(candidate => candidate !== note);
          return { index, status: 'applied' as const, lineId: op.lineId };
        }
        if (op.op === 'add') {
          const lineId = `line-${state.list.lines.length + 1}`;
          state.list.lines.push({ lineId, retailerProductId: op.retailerProductId, description: op.retailerProductId, quantity: op.quantity });
          return { index, status: 'applied' as const, lineId };
        }
        const line = state.list.lines.find(candidate => candidate.lineId === op.lineId);
        if (!line || line.quantity !== op.expectedQuantity) return { index, status: 'conflict' as const };
        if (op.op === 'remove') state.list.lines = state.list.lines.filter(candidate => candidate !== line);
        else line.quantity = op.quantity;
        return { index, status: 'applied' as const, lineId: op.lineId };
      });
      const result = { opId: params.opId, results, list: structuredClone(state.list) };
      state.applied.set(params.opId, result);
      return result;
    });
    return { state, applyList, readList: vi.fn(async () => structuredClone(state.list)) };
  }

  it('adds, follows and removes only managed units', async () => {
    const { installation } = createInstallation('Demo');
    const shop = fakeShop({ listId: 'demo-list', lines: [] });
    exportMilk(installation.id, 2);
    expect(await syncInstallationList(installation.id, { ...shop, now: () => new Date() })).toMatchObject({ status: 'ok', applied: 1 });
    shop.state.list.lines[0].quantity = 5; // a household member adds 3
    exportMilk(installation.id, 1);
    await syncInstallationList(installation.id, { ...shop, now: () => new Date() });
    expect(shop.state.list.lines[0].quantity).toBe(4);
    persistExports(installation.id, 'demo-shop', []);
    await syncInstallationList(installation.id, { ...shop, now: () => new Date() });
    expect(shop.state.list.lines).toEqual([expect.objectContaining({ quantity: 3 })]);
    expect(db.select().from(shopListLines).all()).toEqual([]);
  });

  it('re-sends the same opId after an unknown outcome and never applies twice', async () => {
    const { installation } = createInstallation('Demo');
    const shop = fakeShop({ listId: 'demo-list', lines: [] });
    exportMilk(installation.id, 2);
    const flaky = vi.fn(async (params: ListApplyParams) => {
      await shop.applyList(params);
      throw new PluginCallError('TIMEOUT', 'timed out', 'unknown', true);
    });
    expect(await syncInstallationList(installation.id, { readList: shop.readList, applyList: flaky, now: () => new Date() })).toMatchObject({ status: 'pending_unknown' });
    const pending = getPendingListApply(installation.id);
    expect(pending).not.toBeNull();
    expect(await syncInstallationList(installation.id, { ...shop, now: () => new Date() })).toMatchObject({ status: 'ok', applied: 1 });
    expect(shop.applyList).toHaveBeenLastCalledWith(pending!.params);
    expect(shop.state.list.lines).toEqual([expect.objectContaining({ quantity: 2 })]);
    expect(getPendingListApply(installation.id)).toBeNull();
  });

  it('keeps a mismatched answer pending', async () => {
    const { installation } = createInstallation('Demo');
    const shop = fakeShop({ listId: 'demo-list', lines: [] });
    exportMilk(installation.id, 1);
    const wrong = vi.fn(async (params: ListApplyParams) => ({ ...(await shop.applyList(params)), opId: 'some-other-op' }));
    expect(await syncInstallationList(installation.id, { readList: shop.readList, applyList: wrong, now: () => new Date() })).toMatchObject({ status: 'pending_unknown' });
    expect(getPendingListApply(installation.id)).not.toBeNull();
    expect(db.select().from(shopListLines).all()).toEqual([]);
  });

  it('refuses to touch a different list until the binding is reset', async () => {
    const { installation } = createInstallation('Demo');
    const shop = fakeShop({ listId: 'demo-list', lines: [] });
    exportMilk(installation.id, 1);
    await syncInstallationList(installation.id, { ...shop, now: () => new Date() });
    shop.state.list.listId = 'other-list';
    expect(await syncInstallationList(installation.id, { ...shop, now: () => new Date() })).toMatchObject({ status: 'list_changed' });
    expect(shop.applyList).toHaveBeenCalledTimes(1);
  });

  it('lets only one of two overlapping runs write', async () => {
    const { installation } = createInstallation('Demo');
    const shop = fakeShop({ listId: 'demo-list', lines: [] });
    exportMilk(installation.id, 2);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const slowRead = vi.fn(async () => { await gate; return shop.readList(); });
    const first = syncInstallationList(installation.id, { readList: slowRead, applyList: shop.applyList, now: () => new Date() });
    const second = await syncInstallationList(installation.id, { ...shop, now: () => new Date() });
    expect(second.status).toBe('skipped');
    expect(resolvePausedListLine(installation.id, 'milk', 'release')).toBe('busy');
    release();
    expect(await first).toMatchObject({ status: 'ok', applied: 1 });
    expect(shop.state.list.lines).toHaveLength(1);
  });
});

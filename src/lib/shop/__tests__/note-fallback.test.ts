import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { createTestDb } = await import('@/test-utils/test-db');
  return { db: createTestDb() };
});

import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { POST } from '@/app/api/shop/lists/fallback/route';
import { createInstallation, recordHello, resetInstallationBinding } from '@/lib/plugins/installations';
import { PluginCallError } from '@/lib/plugins/gateway';
import type { HelloParams, ListApplyParams, ListApplyResult, ListOpResult, ShopList } from '@/lib/plugins/protocol/v1';
import { normalizeNoteText, planListSync, recordsAfterApply, resolvePausedLine, type DesiredNote, type LineRecord } from '../list-ownership';
import { getPendingListApply, listLineRecords, listReplacementBlocks, noteTextForExport, resetListOwnership, resolvePausedListLine, syncInstallationList } from '../list-sync';
import { manualNoteProductIds, setListFallbackMode } from '../note-preferences';
import { installationViews } from '../overview';
import { listActiveExports, persistExports } from '../projection';
import { deleteRetailerMapping, getRetailerMapping, getRetailerProduct, setRetailerMappingRole, upsertRetailerMapping, upsertRetailerProducts } from '../retailer-catalog';

beforeEach(() => {
  for (const table of Object.values(schema)) {
    if (table && typeof table === 'object' && Symbol.for('drizzle:Name') in (table as object)) db.delete(table as typeof schema.receipts).run();
  }
});

const NOTE = 'Kipfilet — 500 g';

function noteRecord(overrides: Partial<LineRecord> = {}): LineRecord {
  return {
    retailerProductId: 'chicken', kind: 'note', noteText: NOTE, lineId: 'n1', managedQty: 1, baselineUserQty: 0, lastWrittenQty: 1,
    pausedReason: null, pausedObservedQty: null, releasedExportId: null, ...overrides,
  };
}

const list = (lines: ShopList['lines']): ShopList => ({ listId: 'list', lines });
const notes = (text = NOTE, exportId = 'e1') => new Map<string, DesiredNote>([['chicken', { text, exportId }]]);
const plan = (records: LineRecord[], desired: Map<string, DesiredNote>, shopList: ShopList, notesSupported = true) =>
  planListSync(records, new Map(), shopList, { desiredNotes: desired, notesSupported });

describe('note planning', () => {
  it('adds one note for a discontinued product and owns it once applied', () => {
    const result = plan([], notes(), list([]));
    expect(result.ops).toEqual([expect.objectContaining({ kind: 'note', op: { op: 'add_note', text: NOTE }, onApplied: expect.objectContaining({ kind: 'note', noteText: NOTE }) })]);
  });

  it('never claims or duplicates an identical note someone else wrote', () => {
    const userNote = { lineId: 'u1', retailerProductId: null, description: '  kipfilet —  500 G ', quantity: 1 };
    const result = plan([], notes(), list([userNote]));
    expect(result.ops).toEqual([]);
    expect(result.immediate).toEqual([]);
  });

  it('removes only our own note when demand ends and leaves user notes alone', () => {
    const shopList = list([
      { lineId: 'n1', retailerProductId: null, description: NOTE, quantity: 1 },
      { lineId: 'u1', retailerProductId: null, description: 'Bring bags', quantity: 1 },
    ]);
    const result = plan([noteRecord()], new Map(), shopList);
    expect(result.ops.map(op => op.op)).toEqual([{ op: 'remove_note', lineId: 'n1', expectedText: NOTE }]);
    expect(result.ops[0].onConflict).toBeNull();
  });

  it('replaces a note in stages: only the removal is planned while the old note is ours', () => {
    const shopList = list([{ lineId: 'n1', retailerProductId: null, description: NOTE, quantity: 1 }]);
    const result = plan([noteRecord()], notes('Kipfilet — 750 g', 'e2'), shopList);
    expect(result.ops.map(op => op.op)).toEqual([{ op: 'remove_note', lineId: 'n1', expectedText: NOTE }]);
    // A failed removal keeps ownership; a conflicting one releases the old note instead of adding beside it.
    expect(recordsAfterApply(result, [{ index: 0, status: 'failed' }])).toEqual([]);
    expect(recordsAfterApply(result, [{ index: 0, status: 'conflict' }])).toEqual([
      { retailerProductId: 'chicken', kind: 'note', record: expect.objectContaining({ pausedReason: 'released', releasedExportId: 'e2' }) },
    ]);
    expect(recordsAfterApply(result, [{ index: 0, status: 'applied', lineId: 'n1' }])).toEqual([{ retailerProductId: 'chicken', kind: 'note', record: null }]);
    expect(plan([], notes('Kipfilet — 750 g', 'e2'), list([])).ops.map(op => op.op)).toEqual([{ op: 'add_note', text: 'Kipfilet — 750 g' }]);
  });

  it('never plans a note while our product line for the same demand is still managed, and vice versa', () => {
    const productRecord: LineRecord = { ...noteRecord(), kind: 'product', noteText: null, lineId: 'p1', managedQty: 1, lastWrittenQty: 1 };
    const productLine = { lineId: 'p1', retailerProductId: 'chicken', description: 'AH Kipfilet', quantity: 1 };
    const toNote = plan([productRecord], notes(), list([productLine]));
    expect(toNote.ops.map(op => op.op)).toEqual([{ op: 'remove', lineId: 'p1', expectedQuantity: 1 }]);

    const noteLine = { lineId: 'n1', retailerProductId: null, description: NOTE, quantity: 1 };
    const back = planListSync([noteRecord()], new Map([['chicken', { packages: 1, exportId: 'e1' }]]), list([noteLine]), { desiredNotes: new Map(), notesSupported: true });
    expect(back.ops.map(op => op.op)).toEqual([{ op: 'remove_note', lineId: 'n1', expectedText: NOTE }]);
  });

  it('releases a note that someone removed and re-adds it only after the demand changes', () => {
    const removed = plan([noteRecord()], notes(), list([]));
    expect(removed.ops).toEqual([]);
    const released = removed.immediate[0].record!;
    expect(released).toMatchObject({ kind: 'note', pausedReason: 'released', releasedExportId: 'e1', lineId: null });
    expect(plan([released], notes(), list([])).ops).toEqual([]);
    expect(plan([released], notes('Kipfilet — 750 g', 'e2'), list([])).ops.map(op => op.op)).toEqual([{ op: 'add_note', text: 'Kipfilet — 750 g' }]);
  });

  it('surfaces a missing notes feature instead of sending anything', () => {
    const result = plan([], notes(), list([]), false);
    expect(result.ops).toEqual([]);
    expect(result.immediate).toEqual([{ retailerProductId: 'chicken', kind: 'note', record: expect.objectContaining({ pausedReason: 'notes_unsupported', noteText: NOTE }) }]);
    const waiting = result.immediate[0].record!;
    expect(plan([waiting], notes(), list([]), false).immediate).toEqual([]);
    expect(resolvePausedLine(waiting, 'readd', 'e1')).toMatchObject({ kind: 'note', pausedReason: 'released' });
  });

  it('compares note text like retailers do', () => {
    expect(normalizeNoteText(' Kipfilet   —  500 G ')).toBe(normalizeNoteText(NOTE));
  });
});

function hello(overrides: Partial<HelloParams> = {}): HelloParams {
  return {
    pluginName: 'Demo', pluginVersion: '1.0.0', providerId: 'demo-shop', providerLabel: 'Demo shop', accountKey: 'demo-account',
    accountLabel: 'Demo', protocolVersions: [1], capabilities: ['catalog', 'list'], features: ['list.notes'], authState: 'authenticated', ...overrides,
  };
}

function setup() {
  const { installation } = createInstallation('Demo');
  recordHello(installation.id, hello());
  upsertRetailerProducts('demo-shop', [{ id: 'chicken', name: 'AH Kipfilet 500 g', packageAmount: 500, packageUnit: 'g', measure: 'unit' }]);
  upsertRetailerMapping({
    providerId: 'demo-shop', retailerProductId: 'chicken', targetKind: 'grocy_product', targetId: '7', targetName: 'Kipfilet',
    role: 'preferred', baseUnitId: '3', baseUnitName: 'g', packageBaseAmount: 500, confirm: true,
  });
  return installation.id;
}

function exportChicken(installationId: string, grams: number, at = new Date()) {
  persistExports(installationId, 'demo-shop', [{
    retailerProductId: 'chicken', packages: Math.ceil(grams / 500), baseAmount: grams,
    allocations: [{ revisionId: `rev-${grams}`, mealieItemId: 'row-chicken', targetKind: 'grocy_product', targetId: '7', baseAmount: grams, rowFactor: 1 }],
  }], at);
}

function discontinue() {
  upsertRetailerProducts('demo-shop', [{ id: 'chicken', name: 'AH Kipfilet 500 g', measure: 'unit', availability: 'discontinued' }]);
}

/** Synthetic retailer that keeps per-opId results, like a conforming plugin. */
function fakeShop(initial: ShopList, options: { refuseAdd?: ListOpResult['reason'] } = {}) {
  const state = {
    list: structuredClone(initial),
    applied: new Map<string, ListApplyResult>(),
    /** Force a per-op outcome without changing the list. */
    force: null as null | ((op: ListApplyParams['ops'][number]) => 'failed' | 'conflict' | undefined),
  };
  const applyList = vi.fn(async (params: ListApplyParams): Promise<ListApplyResult> => {
    const cached = state.applied.get(params.opId);
    if (cached) return structuredClone(cached);
    const results: ListOpResult[] = params.ops.map((op, index) => {
      const forced = state.force?.(op);
      if (forced) return { index, status: forced };
      if (op.op === 'add_note') {
        if (state.list.lines.some(line => line.retailerProductId === null && normalizeNoteText(line.description) === normalizeNoteText(op.text))) {
          return { index, status: 'conflict', reason: 'note_exists' };
        }
        const lineId = `note-${index}-${state.list.lines.length + 1}`;
        state.list.lines.push({ lineId, retailerProductId: null, description: op.text, quantity: 1 });
        return { index, status: 'applied', lineId };
      }
      if (op.op === 'remove_note') {
        const note = state.list.lines.find(line => line.lineId === op.lineId);
        if (!note || note.description !== op.expectedText) return { index, status: 'conflict' };
        state.list.lines = state.list.lines.filter(line => line !== note);
        return { index, status: 'applied', lineId: op.lineId };
      }
      if (op.op === 'add') {
        if (options.refuseAdd) return { index, status: 'failed', reason: options.refuseAdd, message: 'Not available.' };
        const lineId = `line-${state.list.lines.length + 1}`;
        state.list.lines.push({ lineId, retailerProductId: op.retailerProductId, description: op.retailerProductId, quantity: op.quantity });
        return { index, status: 'applied', lineId };
      }
      const line = state.list.lines.find(candidate => candidate.lineId === op.lineId);
      if (!line || line.quantity !== op.expectedQuantity) return { index, status: 'conflict' };
      if (op.op === 'remove') state.list.lines = state.list.lines.filter(candidate => candidate !== line);
      else line.quantity = op.quantity;
      return { index, status: 'applied', lineId: op.lineId };
    });
    const result = { opId: params.opId, results, list: structuredClone(state.list) };
    state.applied.set(params.opId, result);
    return structuredClone(result);
  });
  return { state, applyList, readList: vi.fn(async () => structuredClone(state.list)), now: () => new Date(), notesSupported: true };
}

const notesOf = (shop: ReturnType<typeof fakeShop>) => shop.state.list.lines.filter(line => line.retailerProductId === null).map(line => line.description);

describe('list sync with note fallback', () => {
  it('writes the target name and open amount for a discontinued product instead of the product', async () => {
    const id = setup();
    exportChicken(id, 500);
    discontinue();
    expect(noteTextForExport(listActiveExports(id)[0], 'demo-shop')).toBe(NOTE);
    const shop = fakeShop({ listId: 'demo-list', lines: [] });
    expect(await syncInstallationList(id, shop)).toMatchObject({ status: 'ok', applied: 1 });
    expect(shop.state.list.lines).toEqual([expect.objectContaining({ retailerProductId: null, description: NOTE })]);
    // Demand stays attached to the original export for receipt attribution.
    expect(listActiveExports(id)[0].noteExposedAt).toBeInstanceOf(Date);
    expect(await syncInstallationList(id, shop)).toMatchObject({ status: 'ok', applied: 0 });
    expect(notesOf(shop)).toEqual([NOTE]);
  });

  it('keeps a temporarily unavailable product on the list and never substitutes an alternative', async () => {
    const id = setup();
    upsertRetailerProducts('demo-shop', [{ id: 'chicken-alt', name: 'Other chicken', measure: 'unit', availability: 'available' }]);
    upsertRetailerMapping({ providerId: 'demo-shop', retailerProductId: 'chicken-alt', targetKind: 'grocy_product', targetId: '7', targetName: 'Kipfilet', role: 'alternative', baseUnitId: '3', baseUnitName: 'g', packageBaseAmount: 400, confirm: true });
    upsertRetailerProducts('demo-shop', [{ id: 'chicken', name: 'AH Kipfilet 500 g', measure: 'unit', availability: 'temporarily_unavailable' }]);
    exportChicken(id, 1000);
    const shop = fakeShop({ listId: 'demo-list', lines: [] });
    await syncInstallationList(id, shop);
    expect(shop.state.list.lines).toEqual([expect.objectContaining({ retailerProductId: 'chicken', quantity: 2 })]);
  });

  it('switches to a note only after the retailer definitively refuses the product as no longer sold', async () => {
    const id = setup();
    exportChicken(id, 500);
    const shop = fakeShop({ listId: 'demo-list', lines: [] }, { refuseAdd: 'product_discontinued' });
    expect(await syncInstallationList(id, shop)).toMatchObject({ failed: 1, discontinued: ['chicken'] });
    expect(getRetailerProduct('demo-shop', 'chicken')).toMatchObject({ availability: 'discontinued', availabilityCheckedAt: expect.any(Date) });
    await syncInstallationList(id, shop);
    expect(notesOf(shop)).toEqual([NOTE]);
  });

  it('treats a temporary refusal as temporary', async () => {
    const id = setup();
    exportChicken(id, 500);
    const shop = fakeShop({ listId: 'demo-list', lines: [] }, { refuseAdd: 'product_temporarily_unavailable' });
    await syncInstallationList(id, shop);
    await syncInstallationList(id, shop);
    expect(getRetailerProduct('demo-shop', 'chicken')?.availability).toBe('unknown');
    expect(notesOf(shop)).toEqual([]);
    expect(shop.applyList.mock.calls.every(([params]) => params.ops.every(op => op.op === 'add'))).toBe(true);
  });

  it('retains an uncertain note write, replays the same operation and never duplicates the note', async () => {
    const id = setup();
    exportChicken(id, 500);
    discontinue();
    const shop = fakeShop({ listId: 'demo-list', lines: [] });
    const realApply = shop.applyList.getMockImplementation()!;
    // The plugin applies the write but the answer is lost.
    shop.applyList.mockImplementationOnce(async (params) => {
      await realApply(params);
      throw new PluginCallError('TIMEOUT', 'Plugin did not answer list.apply in time', 'unknown', true);
    });
    expect(await syncInstallationList(id, shop)).toMatchObject({ status: 'pending_unknown' });
    const pending = getPendingListApply(id)!;
    expect(pending.params.ops).toEqual([{ op: 'add_note', text: NOTE }]);
    // A replay that cannot reach the plugin keeps the uncertainty.
    shop.applyList.mockRejectedValueOnce(new PluginCallError('NOT_CONNECTED', 'Plugin is not connected', 'not_applied', true));
    expect(await syncInstallationList(id, shop)).toMatchObject({ status: 'pending_unknown' });
    expect(getPendingListApply(id)?.params.opId).toBe(pending.params.opId);

    // After a restart the persisted operation is replayed with the same opId.
    expect(await syncInstallationList(id, shop)).toMatchObject({ status: 'ok' });
    expect(shop.applyList.mock.calls.at(-1)![0].opId).toBe(pending.params.opId);
    expect(getPendingListApply(id)).toBeNull();
    expect(notesOf(shop)).toEqual([NOTE]);
    expect(listLineRecords(id)).toEqual([expect.objectContaining({ kind: 'note', noteText: NOTE, lineId: expect.any(String) })]);
  });

  it('leaves a note unowned when the plugin settles an uncertain add as note_exists', async () => {
    const id = setup();
    exportChicken(id, 500);
    discontinue();
    const shop = fakeShop({ listId: 'demo-list', lines: [] });
    shop.applyList.mockRejectedValueOnce(new PluginCallError('TIMEOUT', 'Plugin did not answer list.apply in time', 'unknown', true));
    expect(await syncInstallationList(id, shop)).toMatchObject({ status: 'pending_unknown' });
    const { opId } = getPendingListApply(id)!.params;
    // The late write landed (or a user added the same text); the plugin cannot prove it is ours.
    shop.state.list.lines.push({ lineId: 'late', retailerProductId: null, description: NOTE, quantity: 1 });
    shop.state.applied.set(opId, { opId, results: [{ index: 0, status: 'conflict', reason: 'note_exists' }], list: structuredClone(shop.state.list) });
    expect(await syncInstallationList(id, shop)).toMatchObject({ status: 'ok', conflicts: 1 });
    expect(listLineRecords(id)).toEqual([]);
    expect(listActiveExports(id)[0].noteExposedAt).toBeInstanceOf(Date);
    await syncInstallationList(id, shop);
    persistExports(id, 'demo-shop', []);
    await syncInstallationList(id, shop);
    expect(notesOf(shop)).toEqual([NOTE]);
  });

  it('does not take over an identical user note and leaves it when demand ends', async () => {
    const id = setup();
    exportChicken(id, 500);
    discontinue();
    const shop = fakeShop({ listId: 'demo-list', lines: [{ lineId: 'mine', retailerProductId: null, description: 'kipfilet — 500 g', quantity: 1 }] });
    await syncInstallationList(id, shop);
    expect(shop.applyList).not.toHaveBeenCalled();
    expect(listLineRecords(id)).toEqual([]);
    persistExports(id, 'demo-shop', []);
    await syncInstallationList(id, shop);
    expect(notesOf(shop)).toEqual(['kipfilet — 500 g']);
  });

  it('retires our product units before the note, replaces notes in stages and removes them when demand ends', async () => {
    const id = setup();
    exportChicken(id, 500);
    const shop = fakeShop({ listId: 'demo-list', lines: [] });
    await syncInstallationList(id, shop);
    expect(shop.state.list.lines).toEqual([expect.objectContaining({ retailerProductId: 'chicken', quantity: 1 })]);
    discontinue();
    await syncInstallationList(id, shop);
    expect(shop.state.list.lines).toEqual([]);
    await syncInstallationList(id, shop);
    expect(shop.state.list.lines).toEqual([expect.objectContaining({ retailerProductId: null, description: NOTE })]);
    exportChicken(id, 750);
    await syncInstallationList(id, shop);
    expect(notesOf(shop)).toEqual([]);
    await syncInstallationList(id, shop);
    expect(notesOf(shop)).toEqual(['Kipfilet — 750 g']);
    persistExports(id, 'demo-shop', []);
    await syncInstallationList(id, shop);
    expect(shop.state.list.lines).toEqual([]);
    expect(listLineRecords(id)).toEqual([]);
  });

  it('keeps the user baseline and never shows our product and our note together when removal fails', async () => {
    const id = setup();
    exportChicken(id, 500);
    const shop = fakeShop({ listId: 'demo-list', lines: [{ lineId: 'p', retailerProductId: 'chicken', description: 'AH Kipfilet', quantity: 2 }] });
    await syncInstallationList(id, shop);
    expect(shop.state.list.lines).toEqual([expect.objectContaining({ lineId: 'p', quantity: 3 })]);
    discontinue();
    shop.state.force = op => (op.op === 'set' || op.op === 'remove' ? 'failed' : undefined);
    await syncInstallationList(id, shop);
    await syncInstallationList(id, shop);
    expect(notesOf(shop)).toEqual([]);
    shop.state.force = null;
    await syncInstallationList(id, shop);
    expect(shop.state.list.lines).toEqual([expect.objectContaining({ lineId: 'p', quantity: 2 })]);
    await syncInstallationList(id, shop);
    // The user's own two packages stay; only our unit became a note.
    expect(shop.state.list.lines).toEqual([
      expect.objectContaining({ lineId: 'p', quantity: 2 }),
      expect.objectContaining({ retailerProductId: null, description: NOTE }),
    ]);
  });

  it('keeps ownership after a failed note removal and adds nothing beside it', async () => {
    const id = setup();
    exportChicken(id, 500);
    discontinue();
    const shop = fakeShop({ listId: 'demo-list', lines: [] });
    await syncInstallationList(id, shop);
    exportChicken(id, 750);
    shop.state.force = op => (op.op === 'remove_note' ? 'failed' : undefined);
    await syncInstallationList(id, shop);
    await syncInstallationList(id, shop);
    expect(notesOf(shop)).toEqual([NOTE]);
    expect(listLineRecords(id)).toEqual([expect.objectContaining({ kind: 'note', noteText: NOTE, pausedReason: null })]);
  });

  it('releases a note whose removal conflicts and does not add a second one', async () => {
    const id = setup();
    exportChicken(id, 500);
    discontinue();
    const shop = fakeShop({ listId: 'demo-list', lines: [] });
    await syncInstallationList(id, shop);
    exportChicken(id, 750);
    shop.state.force = op => (op.op === 'remove_note' ? 'conflict' : undefined);
    await syncInstallationList(id, shop);
    shop.state.force = null;
    await syncInstallationList(id, shop);
    expect(notesOf(shop)).toEqual([NOTE]);
    expect(listLineRecords(id)).toEqual([expect.objectContaining({ kind: 'note', pausedReason: 'released' })]);
  });

  it('holds the replacement while a note removal is uncertain', async () => {
    const id = setup();
    exportChicken(id, 500);
    discontinue();
    const shop = fakeShop({ listId: 'demo-list', lines: [] });
    await syncInstallationList(id, shop);
    exportChicken(id, 750);
    shop.applyList.mockRejectedValueOnce(new PluginCallError('TIMEOUT', 'Plugin did not answer list.apply in time', 'unknown', true));
    expect(await syncInstallationList(id, shop)).toMatchObject({ status: 'pending_unknown' });
    shop.applyList.mockRejectedValueOnce(new PluginCallError('UPSTREAM_UNAVAILABLE', 'Retailer unavailable', 'unknown', true));
    expect(await syncInstallationList(id, shop)).toMatchObject({ status: 'pending_unknown' });
    expect(notesOf(shop)).toEqual([NOTE]);
    expect(shop.applyList.mock.calls.slice(-2).map(([params]) => params.ops)).toEqual([
      [{ op: 'remove_note', lineId: expect.any(String), expectedText: NOTE }],
      [{ op: 'remove_note', lineId: expect.any(String), expectedText: NOTE }],
    ]);
    await syncInstallationList(id, shop);
    await syncInstallationList(id, shop);
    expect(notesOf(shop)).toEqual(['Kipfilet — 750 g']);
  });

  it('removes our note before the product returns once it is available again', async () => {
    const id = setup();
    exportChicken(id, 500);
    discontinue();
    const shop = fakeShop({ listId: 'demo-list', lines: [] });
    await syncInstallationList(id, shop);
    upsertRetailerProducts('demo-shop', [{ id: 'chicken', name: 'AH Kipfilet 500 g', measure: 'unit', availability: 'available' }]);
    shop.state.force = op => (op.op === 'remove_note' ? 'failed' : undefined);
    await syncInstallationList(id, shop);
    expect(shop.state.list.lines).toEqual([expect.objectContaining({ description: NOTE })]);
    shop.state.force = null;
    await syncInstallationList(id, shop);
    expect(shop.state.list.lines).toEqual([]);
    await syncInstallationList(id, shop);
    expect(shop.state.list.lines).toEqual([expect.objectContaining({ retailerProductId: 'chicken', quantity: 1 })]);
  });

  it('does not re-add a note the user removed until the demand changes', async () => {
    const id = setup();
    exportChicken(id, 500);
    discontinue();
    const shop = fakeShop({ listId: 'demo-list', lines: [] });
    await syncInstallationList(id, shop);
    shop.state.list.lines = [];
    await syncInstallationList(id, shop);
    await syncInstallationList(id, shop);
    expect(notesOf(shop)).toEqual([]);
    exportChicken(id, 1000);
    await syncInstallationList(id, shop);
    expect(notesOf(shop)).toEqual(['Kipfilet — 1000 g']);
  });

  it('reports a plugin without notes for review and sends nothing', async () => {
    const id = setup();
    exportChicken(id, 500);
    discontinue();
    const shop = { ...fakeShop({ listId: 'demo-list', lines: [] }), notesSupported: false };
    expect(await syncInstallationList(id, shop)).toMatchObject({ status: 'ok', paused: 1 });
    expect(shop.applyList).not.toHaveBeenCalled();
    expect(listLineRecords(id)).toEqual([expect.objectContaining({ kind: 'note', pausedReason: 'notes_unsupported' })]);
    expect(resolvePausedListLine(id, 'chicken', 'release', new Date(), 'note')).toBe(true);
    expect(listLineRecords(id)).toEqual([expect.objectContaining({ kind: 'note', pausedReason: 'released' })]);
  });
});

describe('manual note escape', () => {
  const post = (body: unknown) => POST(new Request('http://localhost/api/shop/lists/fallback', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));

  it('validates the installation, account, plugin support and preferred mapping', async () => {
    const id = setup();
    expect((await post({ installationId: id, retailerProductId: 'unknown', mode: 'note' })).status).toBe(409);
    upsertRetailerProducts('demo-shop', [{ id: 'chicken-alt', name: 'Other chicken', measure: 'unit' }]);
    upsertRetailerMapping({ providerId: 'demo-shop', retailerProductId: 'chicken-alt', targetKind: 'grocy_product', targetId: '7', targetName: 'Kipfilet', role: 'alternative', baseUnitId: '3', baseUnitName: 'g', packageBaseAmount: 400, confirm: true });
    expect((await post({ installationId: id, retailerProductId: 'chicken-alt', mode: 'note' })).status).toBe(409);
    expect((await post({ installationId: 'missing', retailerProductId: 'chicken', mode: 'note' })).status).toBe(404);
    expect((await post({ installationId: id, retailerProductId: 'chicken', mode: 'maybe' })).status).toBe(400);

    const { installation: old } = createInstallation('Old plugin');
    recordHello(old.id, hello({ features: undefined }));
    expect((await post({ installationId: old.id, retailerProductId: 'chicken', mode: 'note' })).status).toBe(409);
    const { installation: signedOut } = createInstallation('Signed out');
    recordHello(signedOut.id, hello({ accountKey: null, authState: 'unauthenticated' }));
    expect((await post({ installationId: signedOut.id, retailerProductId: 'chicken', mode: 'note' })).status).toBe(409);

    const response = await post({ installationId: id, retailerProductId: 'chicken', mode: 'note' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ installationId: id, retailerProductId: 'chicken', mode: 'note', manualNoteProductIds: ['chicken'] });
    expect(installationViews().find(view => view.id === id)?.manualNoteProductIds).toEqual(['chicken']);
    // The shared catalogue product is not marked discontinued by a manual choice.
    expect(getRetailerProduct('demo-shop', 'chicken')?.availability).toBe('unknown');
  });

  it('refuses product mode for a product the retailer reports as discontinued', async () => {
    const id = setup();
    discontinue();
    expect((await post({ installationId: id, retailerProductId: 'chicken', mode: 'product' })).status).toBe(409);
  });

  it('switches to a note and back through the staged transitions, keeping demand', async () => {
    const id = setup();
    exportChicken(id, 500);
    const shop = fakeShop({ listId: 'demo-list', lines: [] });
    await syncInstallationList(id, shop);
    expect(shop.state.list.lines).toEqual([expect.objectContaining({ retailerProductId: 'chicken', quantity: 1 })]);
    setListFallbackMode({ installationId: id, retailerProductId: 'chicken', mode: 'note' });
    await syncInstallationList(id, shop);
    expect(shop.state.list.lines).toEqual([]);
    await syncInstallationList(id, shop);
    expect(notesOf(shop)).toEqual([NOTE]);
    expect(listActiveExports(id)).toEqual([expect.objectContaining({ retailerProductId: 'chicken', baseAmount: 500, noteExposedAt: expect.any(Date) })]);
    setListFallbackMode({ installationId: id, retailerProductId: 'chicken', mode: 'product' });
    await syncInstallationList(id, shop);
    expect(shop.state.list.lines).toEqual([]);
    await syncInstallationList(id, shop);
    expect(shop.state.list.lines).toEqual([expect.objectContaining({ retailerProductId: 'chicken', quantity: 1 })]);
  });

  it('keeps choices per account and forgets them on a binding reset', async () => {
    const id = setup();
    setListFallbackMode({ installationId: id, retailerProductId: 'chicken', mode: 'note' });
    expect(manualNoteProductIds(id)).toEqual(['chicken']);
    const { installation: other } = createInstallation('Other account');
    recordHello(other.id, hello({ accountKey: 'other-account' }));
    expect(manualNoteProductIds(other.id)).toEqual([]);

    expect(resetListOwnership(id, () => { resetInstallationBinding(id); })).toBe(true);
    recordHello(id, hello({ accountKey: 'second-account' }));
    expect(manualNoteProductIds(id)).toEqual([]);
    // Even a stale stored choice of the first account never applies to the second.
    recordHello(id, hello({ accountKey: 'second-account' }));
    setListFallbackMode({ installationId: id, retailerProductId: 'chicken', mode: 'note' });
    db.update(schema.pluginInstallations).set({ settingsJson: JSON.stringify({ ...JSON.parse(db.select().from(schema.pluginInstallations).where(eq(schema.pluginInstallations.id, id)).get()!.settingsJson), boundAccountKey: 'third-account' }) })
      .where(eq(schema.pluginInstallations.id, id)).run();
    expect(manualNoteProductIds(id)).toEqual([]);
  });
});


describe('fallback preference lifecycle', () => {
  it('forgets manual choices when preferred mappings are demoted or deleted', () => {
    const id = setup();
    setListFallbackMode({ installationId: id, retailerProductId: 'chicken', mode: 'note' });
    const mapping = getRetailerMapping('demo-shop', 'chicken')!;
    setRetailerMappingRole(mapping.id, 'alternative');
    expect(manualNoteProductIds(id)).toEqual([]);
    setRetailerMappingRole(mapping.id, 'preferred');
    expect(manualNoteProductIds(id)).toEqual([]);
    setListFallbackMode({ installationId: id, retailerProductId: 'chicken', mode: 'note' });
    deleteRetailerMapping(mapping.id);
    expect(manualNoteProductIds(id)).toEqual([]);
  });

  it('forgets the old preferred choice when another product is promoted', () => {
    const id = setup();
    setListFallbackMode({ installationId: id, retailerProductId: 'chicken', mode: 'note' });
    upsertRetailerMapping({ providerId: 'demo-shop', retailerProductId: 'alternative', targetKind: 'grocy_product', targetId: '7', targetName: 'Kipfilet', role: 'preferred', baseUnitId: '3', baseUnitName: 'g' });
    expect(manualNoteProductIds(id)).toEqual([]);
  });

  it('allows a note after the vanished zero-baseline product was paused', () => {
    const record: LineRecord = { ...noteRecord(), kind: 'product', noteText: null, pausedReason: 'line_missing', lineId: 'p1' };
    const result = plan([record], notes(), list([]));
    expect(result.immediate).toContainEqual({ retailerProductId: 'chicken', kind: 'product', record: null });
    expect(result.ops).toEqual([expect.objectContaining({ op: { op: 'add_note', text: NOTE } })]);
    // A household baseline still blocks replacement until the pause is resolved.
    expect(plan([{ ...record, baselineUserQty: 1 }], notes(), list([])).ops).toEqual([]);
  });
});


describe('preferred product replacement staging', () => {
  it.each(['product', 'note'] as const)('waits for the old %s removal before listing another preferred product', async kind => {
    const id = setup(); exportChicken(id, 500);
    if (kind === 'note') discontinue();
    const shop = fakeShop({ listId: 'demo-list', lines: [] });
    await syncInstallationList(id, shop);
    const oldMapping = getRetailerMapping('demo-shop', 'chicken')!;
    deleteRetailerMapping(oldMapping.id); // Staging still works using historical export allocations.
    upsertRetailerProducts('demo-shop', [{ id: 'replacement', name: 'New chicken', measure: 'unit' }]);
    upsertRetailerMapping({ providerId: 'demo-shop', retailerProductId: 'replacement', targetKind: 'grocy_product', targetId: '7', targetName: 'Kipfilet', role: 'preferred', baseUnitId: '3', baseUnitName: 'g', packageBaseAmount: 500, confirm: true });
    persistExports(id, 'demo-shop', [{ retailerProductId: 'replacement', packages: 1, baseAmount: 500,
      allocations: [{ revisionId: 'rev-new', mealieItemId: 'row-chicken', targetKind: 'grocy_product', targetId: '7', baseAmount: 500, rowFactor: 1 }],
    }]);
    shop.state.force = op => op.op === 'remove' || op.op === 'remove_note' ? 'failed' : undefined;
    await syncInstallationList(id, shop);
    expect(shop.applyList.mock.calls.at(-1)![0].ops.map(op => op.op)).toEqual([kind === 'note' ? 'remove_note' : 'remove']);
    expect(shop.state.list.lines).toHaveLength(1);
    expect(shop.state.list.lines.some(line => line.retailerProductId === 'replacement')).toBe(false);
    expect(listReplacementBlocks(id)).toEqual([expect.objectContaining({ retailerProductId: 'replacement', blockingProductName: 'AH Kipfilet 500 g', blockingKind: kind })]);
    expect(installationViews().find(view => view.id === id)?.listReplacementBlocks).toEqual(listReplacementBlocks(id));
    shop.state.force = null;
    await syncInstallationList(id, shop);
    expect(shop.state.list.lines).toEqual([]);
    expect(listReplacementBlocks(id)).toEqual([]);
    await syncInstallationList(id, shop);
    expect(shop.state.list.lines).toEqual([expect.objectContaining({ retailerProductId: 'replacement' })]);
  });
});

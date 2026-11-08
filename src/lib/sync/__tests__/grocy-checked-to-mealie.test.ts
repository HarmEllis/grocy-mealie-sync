import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mockMealieShoppingItem,
  mockProductMapping,
  mockSyncState,
} from './helpers/mocks';

const { mockMappings, mockGrocy, mockSettings, mockState, mockHelpers, mockShoppingList, mockConfig } = vi.hoisted(() => {
  const mockMappings = vi.fn();
  const mockGrocy = {
    getGrocyEntities: vi.fn(),
    updateGrocyEntity: vi.fn(),
    getGrocyStockLogSince: vi.fn(),
    getGrocyNewestStockLogForProduct: vi.fn(),
    getGrocyMaxStockLogId: vi.fn(),
  };
  return {
    mockMappings,
    mockGrocy,
    mockSettings: { resolveShoppingListId: vi.fn() },
    mockState: { getSyncState: vi.fn(), saveSyncState: vi.fn() },
    mockHelpers: { fetchAllMealieShoppingItems: vi.fn() },
    mockShoppingList: { updateShoppingListItem: vi.fn() },
    mockConfig: { syncGrocySideChecked: true },
  };
});

vi.mock('../../db', () => ({
  db: { select: vi.fn(() => ({ from: mockMappings })) },
}));

vi.mock('../../config', () => ({ config: mockConfig }));

vi.mock('../../grocy/types', () => mockGrocy);

vi.mock('../../settings', () => mockSettings);

vi.mock('../state', () => mockState);

vi.mock('../helpers', () => mockHelpers);

vi.mock('../../use-cases/shopping/list', () => mockShoppingList);

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { pollGrocyCheckedToMealie } from '../grocy-checked-to-mealie';

const mapping = mockProductMapping(); // food-1 ↔ grocy product 101

function grocyRow(overrides: Record<string, unknown> = {}) {
  return { id: 5, shopping_list_id: 1, product_id: 101, note: '', amount: 1, done: 0, ...overrides };
}

function baseState(overrides: Parameters<typeof mockSyncState>[0] = {}) {
  return mockSyncState({
    grocyCheckedBootstrapped: true,
    grocyCheckedJournalCursor: 100,
    grocyCheckedRowDoneById: { 5: false },
    ...overrides,
  });
}

async function run() {
  return pollGrocyCheckedToMealie();
}

describe('pollGrocyCheckedToMealie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.syncGrocySideChecked = true;
    mockMappings.mockResolvedValue([mapping]);
    mockSettings.resolveShoppingListId.mockResolvedValue('list-1');
    mockHelpers.fetchAllMealieShoppingItems.mockResolvedValue([mockMealieShoppingItem()]);
    mockGrocy.getGrocyEntities.mockResolvedValue([grocyRow()]);
    mockGrocy.getGrocyStockLogSince.mockResolvedValue([]);
    mockGrocy.getGrocyNewestStockLogForProduct.mockResolvedValue(null);
    mockGrocy.getGrocyMaxStockLogId.mockResolvedValue(0);
    mockGrocy.updateGrocyEntity.mockResolvedValue(undefined);
    mockShoppingList.updateShoppingListItem.mockResolvedValue({
      item: mockMealieShoppingItem({ checked: true }),
      updated: { checked: true, quantity: undefined },
    });
    mockState.getSyncState.mockResolvedValue(baseState());
    mockState.saveSyncState.mockResolvedValue(undefined);
  });

  it('skips without touching either API when disabled', async () => {
    mockConfig.syncGrocySideChecked = false;
    const result = await run();
    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('disabled');
    expect(mockGrocy.getGrocyEntities).not.toHaveBeenCalled();
    expect(mockShoppingList.updateShoppingListItem).not.toHaveBeenCalled();
  });

  it('skips when no shopping list is configured', async () => {
    mockSettings.resolveShoppingListId.mockResolvedValue(null);
    const result = await run();
    expect(result.reason).toBe('no-shopping-list');
  });

  it('skips when no product mappings exist', async () => {
    mockMappings.mockResolvedValue([]);
    const result = await run();
    expect(result.reason).toBe('no-product-mappings');
    expect(mockGrocy.getGrocyEntities).not.toHaveBeenCalled();
  });

  it('bootstrap poll snapshots Grocy state and propagates nothing', async () => {
    mockState.getSyncState.mockResolvedValue(baseState({ grocyCheckedBootstrapped: false }));
    mockGrocy.getGrocyEntities.mockResolvedValue([grocyRow({ done: 1 })]);
    mockGrocy.getGrocyMaxStockLogId.mockResolvedValue(77);

    const result = await run();

    expect(result.status).toBe('ok');
    expect(result.reason).toBe('bootstrap');
    expect(mockShoppingList.updateShoppingListItem).not.toHaveBeenCalled();
    expect(mockGrocy.updateGrocyEntity).not.toHaveBeenCalled();
    const saved = mockState.saveSyncState.mock.calls[0][0];
    expect(saved.grocyCheckedBootstrapped).toBe(true);
    expect(saved.grocyCheckedJournalCursor).toBe(77);
    expect(saved.grocyCheckedRowDoneById[5]).toBe(true);
  });

  it('checks the Mealie item when a Grocy row goes done 0→1 and pins the mealie-checked state', async () => {
    mockGrocy.getGrocyEntities.mockResolvedValue([grocyRow({ done: 1 })]);

    const result = await run();

    expect(result.summary.rowsChecked).toBe(1);
    expect(mockShoppingList.updateShoppingListItem).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'mealie-item-1', checked: true }),
    );
    const saved = mockState.saveSyncState.mock.calls[0][0];
    // Direction-3 suppression pin (prevents a second booking in mealie-to-grocy)
    expect(saved.mealieCheckedItems['mealie-item-1']).toBe(true);
    expect(saved.grocyCheckedRowDoneById[5]).toBe(true);
  });

  it('is a no-op when the Mealie item is already checked but still writes the pin', async () => {
    mockGrocy.getGrocyEntities.mockResolvedValue([grocyRow({ done: 1 })]);
    mockHelpers.fetchAllMealieShoppingItems.mockResolvedValue([mockMealieShoppingItem({ checked: true })]);

    const result = await run();

    expect(mockShoppingList.updateShoppingListItem).not.toHaveBeenCalled();
    expect(result.summary.rowsChecked).toBe(0);
    const saved = mockState.saveSyncState.mock.calls[0][0];
    expect(saved.mealieCheckedItems['mealie-item-1']).toBe(true);
  });

  it('unchecks the Mealie item when a Grocy row goes done 1→0', async () => {
    mockState.getSyncState.mockResolvedValue(baseState({ grocyCheckedRowDoneById: { 5: true } }));
    mockHelpers.fetchAllMealieShoppingItems.mockResolvedValue([mockMealieShoppingItem({ checked: true })]);
    mockGrocy.getGrocyEntities.mockResolvedValue([grocyRow({ done: 0 })]);

    const result = await run();

    expect(result.summary.rowsUnchecked).toBe(1);
    expect(mockShoppingList.updateShoppingListItem).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'mealie-item-1', checked: false }),
    );
  });

  it('does not uncheck the Mealie item when a done row disappears (completed list lifecycle)', async () => {
    mockState.getSyncState.mockResolvedValue(baseState({ grocyCheckedRowDoneById: { 5: true } }));
    mockHelpers.fetchAllMealieShoppingItems.mockResolvedValue([mockMealieShoppingItem({ checked: true })]);
    mockGrocy.getGrocyEntities.mockResolvedValue([]);

    const result = await run();

    expect(mockShoppingList.updateShoppingListItem).not.toHaveBeenCalled();
    const saved = mockState.saveSyncState.mock.calls[0][0];
    expect(saved.grocyCheckedRowDoneById[5]).toBeUndefined();
  });

  it('checks the Mealie item for a new positive booking of a mapped product and advances the cursor', async () => {
    mockGrocy.getGrocyStockLogSince.mockResolvedValue([
      { id: 101, product_id: 101, amount: 2, undone: 0 },
    ]);

    const result = await run();

    expect(result.summary.journalAdds).toBe(1);
    expect(mockGrocy.getGrocyStockLogSince).toHaveBeenCalledWith(100);
    expect(mockShoppingList.updateShoppingListItem).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'mealie-item-1', checked: true }),
    );
    const saved = mockState.saveSyncState.mock.calls[0][0];
    expect(saved.grocyCheckedJournalCursor).toBe(101);
  });

  it('ignores negative amounts, undone entries and unmapped products but still advances the cursor', async () => {
    mockGrocy.getGrocyStockLogSince.mockResolvedValue([
      { id: 101, product_id: 999, amount: 3, undone: 0 }, // unmapped product
      { id: 102, product_id: 101, amount: -1, undone: 0 }, // consumption
      { id: 103, product_id: 101, amount: 4, undone: 1 }, // already undone
    ]);

    const result = await run();

    expect(result.summary.journalAdds).toBe(0);
    expect(mockShoppingList.updateShoppingListItem).not.toHaveBeenCalled();
    const saved = mockState.saveSyncState.mock.calls[0][0];
    expect(saved.grocyCheckedJournalCursor).toBe(103);
  });

  it('unchecks the Mealie item when the newest booking of a mapped product was undone (put back)', async () => {
    mockHelpers.fetchAllMealieShoppingItems.mockResolvedValue([mockMealieShoppingItem({ checked: true })]);
    mockGrocy.getGrocyNewestStockLogForProduct.mockResolvedValue({ id: 150, product_id: 101, amount: 1, undone: 1 });

    const result = await run();

    expect(result.summary.journalReverts).toBe(1);
    expect(mockShoppingList.updateShoppingListItem).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'mealie-item-1', checked: false }),
    );
  });

  it('does not revert on put-back when the newest booking is not undone', async () => {
    mockHelpers.fetchAllMealieShoppingItems.mockResolvedValue([mockMealieShoppingItem({ checked: true })]);
    mockGrocy.getGrocyNewestStockLogForProduct.mockResolvedValue({ id: 150, product_id: 101, amount: 1, undone: 0 });

    const result = await run();

    expect(result.summary.journalReverts).toBe(0);
    expect(mockShoppingList.updateShoppingListItem).not.toHaveBeenCalled();
  });

  it('mirrors a Mealie-side uncheck back onto the Grocy row only when this poll previously checked it', async () => {
    mockHelpers.fetchAllMealieShoppingItems.mockResolvedValue([mockMealieShoppingItem({ checked: false })]);
    mockState.getSyncState.mockResolvedValue(baseState({
      grocyCheckedRowDoneById: { 5: true },
      grocyCheckedMealieSnapshotById: { 'mealie-item-1': true },
    }));
    mockGrocy.getGrocyEntities.mockResolvedValue([grocyRow({ done: 1 })]);

    const result = await run();

    expect(result.summary.rowMirrorUpdates).toBe(1);
    expect(mockGrocy.updateGrocyEntity).toHaveBeenCalledWith('shopping_list', 5, { done: 0 });
    const saved = mockState.saveSyncState.mock.calls[0][0];
    expect(saved.grocyCheckedMealieSnapshotById['mealie-item-1']).toBe(false);
  });

  it('never writes Grocy when the row is not done (no phantom uncheck)', async () => {
    mockHelpers.fetchAllMealieShoppingItems.mockResolvedValue([mockMealieShoppingItem({ checked: false })]);
    mockState.getSyncState.mockResolvedValue(baseState({
      grocyCheckedMealieSnapshotById: { 'mealie-item-1': true },
    }));

    const result = await run();

    expect(result.summary.rowMirrorUpdates).toBe(0);
    expect(mockGrocy.updateGrocyEntity).not.toHaveBeenCalled();
  });

  it('reports partial and an issue event when a Mealie write fails', async () => {
    mockGrocy.getGrocyEntities.mockResolvedValue([grocyRow({ done: 1 })]);
    mockShoppingList.updateShoppingListItem.mockRejectedValue(new Error('422 field required'));

    const result = await run();

    expect(result.status).toBe('partial');
    expect(result.summary.failedItems).toBe(1);
    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'issue', level: 'error' }),
    ]));
  });

  it('converges silently when signals overlap (row done + fresh booking, same item)', async () => {
    mockGrocy.getGrocyEntities.mockResolvedValue([grocyRow({ done: 1 })]);
    mockGrocy.getGrocyStockLogSince.mockResolvedValue([
      { id: 101, product_id: 101, amount: 1, undone: 0 },
    ]);

    const result = await run();

    expect(mockShoppingList.updateShoppingListItem).toHaveBeenCalledTimes(1);
    expect(result.summary.rowsChecked).toBe(1);
    expect(result.summary.journalAdds).toBe(0); // second signal finds it converged
  });

  it('returns error status when a Grocy read blows up', async () => {
    mockGrocy.getGrocyEntities.mockRejectedValue(new Error('502 grocy down'));

    const result = await run();

    expect(result.status).toBe('error');
    expect(result.events?.[0]).toEqual(expect.objectContaining({ kind: 'issue', level: 'error' }));
  });
});

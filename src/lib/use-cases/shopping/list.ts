import { HouseholdsShoppingListItemsService } from '@/lib/mealie';
import type { ShoppingListItemCreate } from '@/lib/mealie/client/models/ShoppingListItemCreate';
import type { ShoppingListItemsCollectionOut } from '@/lib/mealie/client/models/ShoppingListItemsCollectionOut';
import type { ShoppingListItemUpdate } from '@/lib/mealie/client/models/ShoppingListItemUpdate';
import type { MealieShoppingItem } from '@/lib/mealie/types';
import { rankVariantMatches } from '@/lib/fuzzy-match';
import { resolveShoppingListId } from '@/lib/settings';
import { fetchAllMealieShoppingItems } from '@/lib/sync/helpers';

export interface ShoppingListItemSummary {
  id: string;
  shoppingListId: string;
  foodId: string | null;
  foodName: string | null;
  unitId: string | null;
  unitName: string | null;
  quantity: number;
  checked: boolean;
  note: string | null;
  display: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ShoppingListItemsResource {
  shoppingListId: string | null;
  configured: boolean;
  counts: {
    total: number;
    unchecked: number;
    checked: number;
  };
  items: ShoppingListItemSummary[];
}

export interface CheckShoppingListProductParams {
  foodId?: string;
  query?: string;
  includeChecked?: boolean;
  maxResults?: number;
}

export interface ShoppingListProductMatch extends ShoppingListItemSummary {
  score: number;
}

export interface CheckShoppingListProductResult {
  shoppingListId: string | null;
  alreadyOnList: boolean;
  matchCount: number;
  matches: ShoppingListProductMatch[];
}

export interface AddShoppingListItemParams {
  foodId: string;
  quantity?: number;
  unitId?: string | null;
  note?: string | null;
  mergeIfExists?: boolean;
}

export interface AddShoppingListItemResult {
  action: 'created' | 'updated';
  merged: boolean;
  item: ShoppingListItemSummary;
}

export interface RemoveShoppingListItemParams {
  itemId: string;
}

export interface RemoveShoppingListItemResult {
  removed: true;
  itemId: string;
}

export interface ShoppingListDeps {
  resolveShoppingListId(): Promise<string | null>;
  fetchShoppingItems(shoppingListId: string): Promise<MealieShoppingItem[]>;
  createShoppingItem(body: ShoppingListItemCreate): Promise<ShoppingListItemsCollectionOut>;
  updateShoppingItem(itemId: string, body: ShoppingListItemUpdate): Promise<ShoppingListItemsCollectionOut>;
  deleteShoppingItem(itemId: string): Promise<unknown>;
}

const defaultDeps: ShoppingListDeps = {
  resolveShoppingListId,
  fetchShoppingItems: fetchAllMealieShoppingItems,
  createShoppingItem: body => HouseholdsShoppingListItemsService.createOneApiHouseholdsShoppingItemsPost(body),
  updateShoppingItem: (itemId, body) => HouseholdsShoppingListItemsService.updateOneApiHouseholdsShoppingItemsItemIdPut(itemId, body),
  deleteShoppingItem: itemId => HouseholdsShoppingListItemsService.deleteOneApiHouseholdsShoppingItemsItemIdDelete(itemId),
};

function requireShoppingListId(shoppingListId: string | null): string {
  if (!shoppingListId) {
    throw new Error('No Mealie shopping list is configured.');
  }

  return shoppingListId;
}

function toShoppingListItemSummary(item: MealieShoppingItem): ShoppingListItemSummary {
  return {
    id: item.id,
    shoppingListId: item.shoppingListId,
    foodId: item.foodId ?? null,
    foodName: item.food?.name ?? null,
    unitId: item.unitId ?? null,
    unitName: item.unit?.name ?? null,
    quantity: Number(item.quantity ?? 1),
    checked: Boolean(item.checked),
    note: item.note ?? null,
    display: item.display ?? null,
    createdAt: item.createdAt ?? null,
    updatedAt: item.updatedAt ?? null,
  };
}

function toSortedShoppingListItemSummaries(items: MealieShoppingItem[]): ShoppingListItemSummary[] {
  return items
    .map(toShoppingListItemSummary)
    .sort((left, right) => {
      if (left.checked !== right.checked) {
        return Number(left.checked) - Number(right.checked);
      }

      const leftLabel = left.display ?? left.foodName ?? left.note ?? left.id;
      const rightLabel = right.display ?? right.foodName ?? right.note ?? right.id;
      return leftLabel.localeCompare(rightLabel);
    });
}

function getShoppingItemMatchVariants(item: ShoppingListItemSummary) {
  return [
    { text: item.display ?? '', kind: 'display', weight: 1 },
    { text: item.foodName ?? '', kind: 'food-name', weight: 1 },
    { text: item.note ?? '', kind: 'note', weight: 0.8 },
  ].filter(variant => variant.text.trim().length > 0);
}

function getUpdatedOrFallbackItem(
  collection: ShoppingListItemsCollectionOut,
  fallback: ShoppingListItemSummary,
): ShoppingListItemSummary {
  const updated = collection.updatedItems?.[0];
  if (updated) {
    return toShoppingListItemSummary(updated);
  }

  return fallback;
}

function getCreatedOrThrowItem(collection: ShoppingListItemsCollectionOut): ShoppingListItemSummary {
  const created = collection.createdItems?.[0];
  if (!created) {
    throw new Error('Mealie did not return the created shopping list item.');
  }

  return toShoppingListItemSummary(created);
}

export async function getShoppingListItemsResource(
  deps: Pick<ShoppingListDeps, 'resolveShoppingListId' | 'fetchShoppingItems'> = defaultDeps,
): Promise<ShoppingListItemsResource> {
  const shoppingListId = await deps.resolveShoppingListId();
  if (!shoppingListId) {
    return {
      shoppingListId: null,
      configured: false,
      counts: {
        total: 0,
        unchecked: 0,
        checked: 0,
      },
      items: [],
    };
  }

  const items = toSortedShoppingListItemSummaries(await deps.fetchShoppingItems(shoppingListId));

  return {
    shoppingListId,
    configured: true,
    counts: {
      total: items.length,
      unchecked: items.filter(item => !item.checked).length,
      checked: items.filter(item => item.checked).length,
    },
    items,
  };
}

export async function checkShoppingListProduct(
  params: CheckShoppingListProductParams,
  deps: Pick<ShoppingListDeps, 'resolveShoppingListId' | 'fetchShoppingItems'> = defaultDeps,
): Promise<CheckShoppingListProductResult> {
  const shoppingListId = await deps.resolveShoppingListId();
  if (!shoppingListId) {
    return {
      shoppingListId: null,
      alreadyOnList: false,
      matchCount: 0,
      matches: [],
    };
  }

  const query = params.query?.trim() ?? '';
  const foodId = params.foodId?.trim() ?? '';
  if (!query && !foodId) {
    throw new Error('Either foodId or query must be provided.');
  }

  const items = toSortedShoppingListItemSummaries(await deps.fetchShoppingItems(shoppingListId))
    .filter(item => params.includeChecked ? true : !item.checked);

  if (foodId) {
    const matches = items
      .filter(item => item.foodId === foodId)
      .map(item => ({ ...item, score: 100 }));

    return {
      shoppingListId,
      alreadyOnList: matches.length > 0,
      matchCount: matches.length,
      matches,
    };
  }

  const matches = rankVariantMatches(
    [{ text: query }],
    items,
    getShoppingItemMatchVariants,
    0.3,
    params.maxResults ?? 10,
  ).map(match => ({
    ...match.item,
    score: Math.round(match.score * 100),
  }));

  return {
    shoppingListId,
    alreadyOnList: matches.length > 0,
    matchCount: matches.length,
    matches,
  };
}

export async function addShoppingListItem(
  params: AddShoppingListItemParams,
  deps: ShoppingListDeps = defaultDeps,
): Promise<AddShoppingListItemResult> {
  const shoppingListId = requireShoppingListId(await deps.resolveShoppingListId());
  const quantity = params.quantity ?? 1;
  if (quantity <= 0) {
    throw new Error('Quantity must be greater than 0.');
  }

  const mergeIfExists = params.mergeIfExists ?? true;
  const items = await deps.fetchShoppingItems(shoppingListId);
  const existingItem = mergeIfExists
    ? items.find(item => item.foodId === params.foodId && !item.checked)
    : undefined;

  if (existingItem) {
    const currentQuantity = Number(existingItem.quantity ?? 1);
    const collection = await deps.updateShoppingItem(existingItem.id, {
      shoppingListId,
      foodId: params.foodId,
      unitId: params.unitId ?? undefined,
      note: params.note ?? undefined,
      quantity: currentQuantity + quantity,
      checked: false,
    });

    return {
      action: 'updated',
      merged: true,
      item: getUpdatedOrFallbackItem(collection, {
        ...toShoppingListItemSummary(existingItem),
        quantity: currentQuantity + quantity,
        unitId: params.unitId ?? existingItem.unitId ?? null,
        unitName: existingItem.unit?.name ?? null,
        note: params.note ?? existingItem.note ?? null,
      }),
    };
  }

  const collection = await deps.createShoppingItem({
    shoppingListId,
    foodId: params.foodId,
    unitId: params.unitId ?? undefined,
    note: params.note ?? undefined,
    quantity,
    checked: false,
  });

  return {
    action: 'created',
    merged: false,
    item: getCreatedOrThrowItem(collection),
  };
}

export async function removeShoppingListItem(
  params: RemoveShoppingListItemParams,
  deps: Pick<ShoppingListDeps, 'deleteShoppingItem'> = defaultDeps,
): Promise<RemoveShoppingListItemResult> {
  await deps.deleteShoppingItem(params.itemId);

  return {
    removed: true,
    itemId: params.itemId,
  };
}

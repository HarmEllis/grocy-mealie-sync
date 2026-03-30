import { HouseholdsShoppingListItemsService } from '@/lib/mealie';
import type { ShoppingListItemCreate } from '@/lib/mealie/client/models/ShoppingListItemCreate';
import type { ShoppingListItemsCollectionOut } from '@/lib/mealie/client/models/ShoppingListItemsCollectionOut';
import type { ShoppingListItemUpdate } from '@/lib/mealie/client/models/ShoppingListItemUpdate';
import type { MealieShoppingItem } from '@/lib/mealie/types';
import { normalizeMatchText, rankVariantMatches } from '@/lib/fuzzy-match';
import { resolveShoppingListId } from '@/lib/settings';
import { fetchAllMealieShoppingItems } from '@/lib/sync/helpers';
import { getProductOverview, type ProductOverview } from '@/lib/use-cases/products/catalog';

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
  foodId?: string;
  query?: string;
  quantity?: number;
  unitId?: string | null;
  note?: string | null;
  mergeIfExists?: boolean;
}

export interface ShoppingListProductResolution {
  query: string;
  matchedQuery: string;
  resolution: 'exact' | 'suffix_note';
  productRef: string;
  foodId: string;
  foodName: string;
  derivedNote: string | null;
  note: string | null;
}

export interface AddShoppingListItemResult {
  action: 'created' | 'updated';
  merged: boolean;
  item: ShoppingListItemSummary;
  resolved: ShoppingListProductResolution | null;
}

export interface RemoveShoppingListItemParams {
  itemId: string;
}

export interface RemoveShoppingListItemResult {
  removed: true;
  itemId: string;
}

export interface UpdateShoppingListItemParams {
  itemId: string;
  checked?: boolean;
  quantity?: number;
}

export interface UpdateShoppingListItemResult {
  item: ShoppingListItemSummary;
  updated: {
    checked?: boolean;
    quantity?: number;
  };
}

export interface MergeShoppingListDuplicatesParams {
  foodId: string;
}

export interface MergeShoppingListDuplicatesResult {
  merged: boolean;
  keptItemId: string | null;
  removedItemIds: string[];
  item: ShoppingListItemSummary | null;
}

export interface ShoppingListDeps {
  resolveShoppingListId(): Promise<string | null>;
  fetchShoppingItems(shoppingListId: string): Promise<MealieShoppingItem[]>;
  getShoppingItem(itemId: string): Promise<MealieShoppingItem>;
  createShoppingItem(body: ShoppingListItemCreate): Promise<ShoppingListItemsCollectionOut>;
  updateShoppingItem(itemId: string, body: ShoppingListItemUpdate): Promise<ShoppingListItemsCollectionOut>;
  deleteShoppingItem(itemId: string): Promise<unknown>;
  getProductOverview(params: { productRef: string }): Promise<ProductOverview>;
}

const defaultDeps: ShoppingListDeps = {
  resolveShoppingListId,
  fetchShoppingItems: fetchAllMealieShoppingItems,
  getShoppingItem: itemId => HouseholdsShoppingListItemsService.getOneApiHouseholdsShoppingItemsItemIdGet(itemId),
  createShoppingItem: body => HouseholdsShoppingListItemsService.createOneApiHouseholdsShoppingItemsPost(body),
  updateShoppingItem: (itemId, body) => HouseholdsShoppingListItemsService.updateOneApiHouseholdsShoppingItemsItemIdPut(itemId, body),
  deleteShoppingItem: itemId => HouseholdsShoppingListItemsService.deleteOneApiHouseholdsShoppingItemsItemIdDelete(itemId),
  getProductOverview,
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

function splitShoppingNoteSegments(note: string | null | undefined): string[] {
  return (note ?? '')
    .split('|')
    .map(segment => segment.trim())
    .filter(Boolean);
}

function mergeShoppingNotes(...notes: Array<string | null | undefined>): string | null {
  const segments: string[] = [];
  const seen = new Set<string>();

  for (const note of notes) {
    for (const segment of splitShoppingNoteSegments(note)) {
      const normalizedSegment = normalizeMatchText(segment);
      if (!normalizedSegment || seen.has(normalizedSegment)) {
        continue;
      }

      seen.add(normalizedSegment);
      segments.push(segment);
    }
  }

  return segments.length > 0 ? segments.join(' | ') : null;
}

function isUnknownProductRefError(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith('Unknown product ref:');
}

async function resolveShoppingProductByName(
  query: string,
  deps: Pick<ShoppingListDeps, 'getProductOverview'>,
): Promise<Omit<ShoppingListProductResolution, 'query' | 'note'>> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error('Query must not be empty.');
  }

  const tokens = trimmedQuery.split(/\s+/);
  const resolutionCandidates = [
    {
      matchedQuery: trimmedQuery,
      resolution: 'exact' as const,
      derivedNote: null,
    },
    ...tokens.slice(1).map((_, index) => {
      const splitIndex = index + 1;
      return {
        matchedQuery: tokens.slice(splitIndex).join(' '),
        resolution: 'suffix_note' as const,
        derivedNote: tokens.slice(0, splitIndex).join(' '),
      };
    }),
  ];

  for (const candidate of resolutionCandidates) {
    try {
      const overview = await deps.getProductOverview({ productRef: candidate.matchedQuery });
      if (!overview.mealieFood) {
        throw new Error(
          `Resolved "${candidate.matchedQuery}" to "${overview.productRef}", but it has no linked Mealie food to add to the shopping list.`,
        );
      }

      return {
        matchedQuery: candidate.matchedQuery,
        resolution: candidate.resolution,
        productRef: overview.productRef,
        foodId: overview.mealieFood.id,
        foodName: overview.mealieFood.name,
        derivedNote: candidate.derivedNote,
      };
    } catch (error) {
      if (isUnknownProductRefError(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    `Could not resolve "${trimmedQuery}" to an exact Mealie shopping product. Try an exact product name or create the product first.`,
  );
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
  const hasFoodId = params.foodId !== undefined && params.foodId !== '';
  const hasQuery = params.query !== undefined && params.query !== '';

  if (hasFoodId && hasQuery) {
    throw new Error('Provide either foodId or query, not both.');
  }

  if (!hasFoodId && !hasQuery) {
    throw new Error('Either foodId or query must be provided.');
  }

  let foodId: string;
  let note = params.note ?? null;
  let resolved: ShoppingListProductResolution | null = null;

  if (hasQuery) {
    const resolution = await resolveShoppingProductByName(params.query!, deps);
    note = mergeShoppingNotes(resolution.derivedNote, params.note);
    foodId = resolution.foodId;
    resolved = {
      query: params.query!.trim(),
      matchedQuery: resolution.matchedQuery,
      resolution: resolution.resolution,
      productRef: resolution.productRef,
      foodId: resolution.foodId,
      foodName: resolution.foodName,
      derivedNote: resolution.derivedNote,
      note,
    };
  } else {
    foodId = params.foodId!;
  }

  const shoppingListId = requireShoppingListId(await deps.resolveShoppingListId());
  const quantity = params.quantity ?? 1;
  if (quantity <= 0) {
    throw new Error('Quantity must be greater than 0.');
  }

  const mergeIfExists = params.mergeIfExists ?? true;
  const items = await deps.fetchShoppingItems(shoppingListId);
  const existingItem = mergeIfExists
    ? items.find(item => item.foodId === foodId && !item.checked)
    : undefined;

  if (existingItem) {
    const currentQuantity = Number(existingItem.quantity ?? 1);
    const mergedNote = mergeShoppingNotes(existingItem.note, note);
    const collection = await deps.updateShoppingItem(existingItem.id, {
      shoppingListId,
      foodId,
      unitId: params.unitId ?? undefined,
      note: mergedNote ?? undefined,
      quantity: currentQuantity + quantity,
      checked: false,
    });

    return {
      action: 'updated',
      merged: true,
      resolved,
      item: getUpdatedOrFallbackItem(collection, {
        ...toShoppingListItemSummary(existingItem),
        quantity: currentQuantity + quantity,
        unitId: params.unitId ?? existingItem.unitId ?? null,
        unitName: existingItem.unit?.name ?? null,
        note: mergedNote,
      }),
    };
  }

  const collection = await deps.createShoppingItem({
    shoppingListId,
    foodId,
    unitId: params.unitId ?? undefined,
    note: note ?? undefined,
    quantity,
    checked: false,
  });

  return {
    action: 'created',
    merged: false,
    resolved,
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

export async function updateShoppingListItem(
  params: UpdateShoppingListItemParams,
  deps: Pick<ShoppingListDeps, 'getShoppingItem' | 'updateShoppingItem'> = defaultDeps,
): Promise<UpdateShoppingListItemResult> {
  if (params.checked === undefined && params.quantity === undefined) {
    throw new Error('At least one shopping list field must be provided to update.');
  }

  if (params.quantity !== undefined && params.quantity < 0) {
    throw new Error('Quantity must be 0 or greater.');
  }

  const currentItem = await deps.getShoppingItem(params.itemId);
  const currentSummary = toShoppingListItemSummary(currentItem);
  const nextQuantity = params.quantity ?? currentSummary.quantity;
  const nextChecked = params.checked ?? currentSummary.checked;

  const collection = await deps.updateShoppingItem(params.itemId, {
    shoppingListId: currentSummary.shoppingListId,
    foodId: currentSummary.foodId ?? undefined,
    unitId: currentSummary.unitId ?? undefined,
    note: currentSummary.note ?? undefined,
    quantity: nextQuantity,
    checked: nextChecked,
  });

  return {
    item: getUpdatedOrFallbackItem(collection, {
      ...currentSummary,
      quantity: nextQuantity,
      checked: nextChecked,
    }),
    updated: {
      checked: params.checked,
      quantity: params.quantity,
    },
  };
}

export async function mergeShoppingListDuplicates(
  params: MergeShoppingListDuplicatesParams,
  deps: Pick<
    ShoppingListDeps,
    'resolveShoppingListId' | 'fetchShoppingItems' | 'updateShoppingItem' | 'deleteShoppingItem'
  > = defaultDeps,
): Promise<MergeShoppingListDuplicatesResult> {
  const shoppingListId = requireShoppingListId(await deps.resolveShoppingListId());
  const duplicateItems = (await deps.fetchShoppingItems(shoppingListId))
    .filter(item => item.foodId === params.foodId && !item.checked);

  if (duplicateItems.length <= 1) {
    return {
      merged: false,
      keptItemId: duplicateItems[0]?.id ?? null,
      removedItemIds: [],
      item: duplicateItems[0] ? toShoppingListItemSummary(duplicateItems[0]) : null,
    };
  }

  const [keptItem, ...itemsToRemove] = duplicateItems;
  const quantity = duplicateItems.reduce((total, item) => total + Number(item.quantity ?? 1), 0);
  const mergedNote = mergeShoppingNotes(...duplicateItems.map(item => item.note));
  const updated = await deps.updateShoppingItem(keptItem.id, {
    shoppingListId,
    foodId: keptItem.foodId ?? undefined,
    unitId: keptItem.unitId ?? undefined,
    note: mergedNote ?? undefined,
    quantity,
    checked: false,
  });

  await Promise.all(itemsToRemove.map(item => deps.deleteShoppingItem(item.id)));

  return {
    merged: true,
    keptItemId: keptItem.id,
    removedItemIds: itemsToRemove.map(item => item.id),
    item: getUpdatedOrFallbackItem(updated, {
      ...toShoppingListItemSummary(keptItem),
      quantity,
      note: mergedNote,
    }),
  };
}

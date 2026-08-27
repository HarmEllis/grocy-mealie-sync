/**
 * Use-cases behind the device "Bladeren" (browse) API: browse products by
 * Mealie label or by an A-Z index. See docs/DEVICE-API.md (firmware repo) for
 * the wire contract. Responses must stay small (< 2 KB) and flat, same
 * constraint as the rest of the device API (see scanner.ts's header comment).
 */

import { db } from '@/lib/db';
import { productMappings } from '@/lib/db/schema';
import { normalizeMatchText } from '@/lib/fuzzy-match';
import { getCurrentStock, getGrocyEntities, type CurrentStockResponse, type Product } from '@/lib/grocy/types';
import { GroupsMultiPurposeLabelsService, RecipesFoodsService } from '@/lib/mealie';
import type { MultiPurposeLabelSummary } from '@/lib/mealie/client/models/MultiPurposeLabelSummary';
import { DeviceUpstreamTimeoutError } from './scanner';

// ---------------------------------------------------------------------------
// Response shapes (mirror docs/DEVICE-API.md)
// ---------------------------------------------------------------------------

export interface DeviceLabelBucket {
  id: string;
  name: string;
  count: number;
}

export interface DeviceLabelListResult {
  labels: DeviceLabelBucket[];
}

export interface DeviceLetterBucket {
  letter: string;
  count: number;
}

export interface DeviceLetterListResult {
  letters: DeviceLetterBucket[];
}

export interface DeviceBrowseProductsResult {
  results: Array<{ id: number; name: string; stockAmount: number }>;
  total: number;
  offset: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Synthetic bucket for Grocy products with no resolvable Mealie label. */
export const UNLABELED_ID = 'unlabeled';
const UNLABELED_NAME = 'Overig';

/**
 * `/labels` is not paginated in v1. Real labels are ranked by product count
 * and capped so the response stays well under the firmware's 4096-byte
 * MAX_RESPONSE and the documented ~2KB budget; `unlabeled` is always appended
 * as an extra item outside this cap so unlabeled products stay reachable via
 * label-browse regardless of how many other labels exist.
 */
const REAL_LABEL_CAP = 19;

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
/** Products whose normalized name doesn't start with a-z land here. */
const OTHER_LETTER = '#';

const DRAIN_PAGE_SIZE = 500;
const SNAPSHOT_TTL_MS = 30_000;
/* Leaves margin under the firmware's fixed 8s HTTP timeout for the request
 * round-trip itself; the snapshot build (page-draining Mealie foods/labels +
 * two Grocy calls) must not be allowed to run unbounded for a large catalogue
 * or a slow upstream. */
const SNAPSHOT_BUILD_TIMEOUT_MS = 6_000;

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 20;

/* Matches the firmware's API_NAME_LEN (64 bytes incl. NUL, so 63 usable) —
 * caps any externally-sourced name (Mealie label, Grocy/Mealie product) so a
 * single unusually long or multi-byte-heavy name cannot inflate a response
 * past the firmware's hard 4096-byte MAX_RESPONSE buffer despite the item-
 * count caps below. */
const MAX_NAME_BYTES = 63;

// ---------------------------------------------------------------------------
// Dependencies (injected for tests)
// ---------------------------------------------------------------------------

export interface DeviceBrowseMealieFood {
  id: string;
  name: string;
  labelId: string | null;
}

export interface DeviceBrowseProductMapping {
  grocyProductId: number;
  mealieFoodId: string;
}

export interface DeviceBrowseDeps {
  listGrocyProducts: () => Promise<Product[]>;
  listProductMappings: () => Promise<DeviceBrowseProductMapping[]>;
  listMealieFoods: () => Promise<DeviceBrowseMealieFood[]>;
  listMealieLabels: () => Promise<MultiPurposeLabelSummary[]>;
  getCurrentStock: () => Promise<CurrentStockResponse[]>;
}

/**
 * Drain every page of a Mealie list endpoint. Mirrors the precedent in
 * src/lib/use-cases/units/manage.ts (listAllMealieShoppingItems /
 * listAllMealieRecipeSummaries): fixed page size, stop once a page comes back
 * shorter than requested. This is robust even if `total_pages` is absent or
 * wrong, unlike relying on a single very-large `perPage` request.
 */
export async function drainPages<TItem>(
  fetchPage: (page: number, perPage: number) => Promise<{ items?: TItem[] }>,
): Promise<TItem[]> {
  const items: TItem[] = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await fetchPage(page, DRAIN_PAGE_SIZE);
    const pageItems = response.items ?? [];
    items.push(...pageItems);
    if (pageItems.length < DRAIN_PAGE_SIZE) {
      break;
    }
    page += 1;
  }
  return items;
}

async function fetchAllMealieLabels(): Promise<MultiPurposeLabelSummary[]> {
  return drainPages(async (page, perPage) => {
    const response = await GroupsMultiPurposeLabelsService.getAllApiGroupsLabelsGet(
      undefined,
      undefined,
      undefined,
      'asc',
      undefined,
      undefined,
      page,
      perPage,
    );
    return { items: response.items };
  });
}

async function fetchAllMealieFoods(): Promise<DeviceBrowseMealieFood[]> {
  const rawFoods = await drainPages(async (page, perPage) => {
    const response = await RecipesFoodsService.getAllApiFoodsGet(
      undefined,
      undefined,
      undefined,
      'asc',
      undefined,
      undefined,
      page,
      perPage,
    );
    return { items: response.items };
  });

  return rawFoods
    .filter((food): food is typeof food & { id: string } => typeof food.id === 'string' && food.id.length > 0)
    .map(food => ({ id: food.id, name: food.name || 'Unknown', labelId: food.labelId ?? null }));
}

const defaultDeps: DeviceBrowseDeps = {
  listGrocyProducts: () => getGrocyEntities('products'),
  listProductMappings: async () => db
    .select({ grocyProductId: productMappings.grocyProductId, mealieFoodId: productMappings.mealieFoodId })
    .from(productMappings),
  listMealieFoods: fetchAllMealieFoods,
  listMealieLabels: fetchAllMealieLabels,
  getCurrentStock,
};

// ---------------------------------------------------------------------------
// Snapshot cache
//
// /labels, /letters, and every /products?labelId=/letter= call need the same
// full join (Grocy products, DB mappings, all Mealie foods, all Mealie
// labels, current stock). Rebuilding it per request would run this cost at
// least twice per browse session inside the firmware's 8s HTTP timeout, so a
// short-TTL in-process snapshot is shared across all four use-cases below.
// Concurrent callers during a rebuild share the same in-flight promise so a
// burst of requests doesn't trigger duplicate simultaneous builds.
// ---------------------------------------------------------------------------

interface BrowseSnapshot {
  builtAt: number;
  products: Product[];
  labelNameById: Map<string, string>;
  /** Every valid Grocy product id maps to exactly one entry: a real label id
   * or UNLABELED_ID. Never absent for a product present in `products`. */
  labelIdByGrocyProductId: Map<number, string>;
  stockByGrocyProductId: Map<number, number>;
}

let cachedSnapshot: BrowseSnapshot | null = null;
let inFlightBuild: Promise<BrowseSnapshot> | null = null;

/**
 * Force the next browse call to rebuild the snapshot instead of serving a
 * cached one. Not wired to any mutation path yet in v1 (see plan) — exported
 * now as a safe integration point for a follow-up.
 */
export function invalidateBrowseSnapshot(): void {
  cachedSnapshot = null;
  inFlightBuild = null;
}

function buildCurrentStockMap(currentStock: CurrentStockResponse[]): Map<number, number> {
  return new Map(currentStock.map(entry => [
    Number(entry.product_id),
    Number(entry.amount_aggregated ?? entry.amount ?? 0),
  ]));
}

async function buildSnapshot(deps: DeviceBrowseDeps): Promise<BrowseSnapshot> {
  const [products, mappings, foods, labels, currentStock] = await Promise.all([
    deps.listGrocyProducts(),
    deps.listProductMappings(),
    deps.listMealieFoods(),
    deps.listMealieLabels(),
    deps.getCurrentStock(),
  ]);

  const labelNameById = new Map(labels.map(label => [label.id, label.name]));
  const foodById = new Map(foods.map(food => [food.id, food]));
  const mealieFoodIdByGrocyProductId = new Map(mappings.map(m => [m.grocyProductId, m.mealieFoodId]));

  // Every valid Grocy product resolves to exactly one bucket: mapping ->
  // existing food -> existing label, else unlabeled. This also covers a
  // stale mapping (deleted food) and a food whose labelId no longer exists
  // among the fetched labels, not just "no mapping".
  const labelIdByGrocyProductId = new Map<number, string>();
  for (const product of products) {
    if (!product.id) {
      continue;
    }
    const grocyProductId = Number(product.id);
    const mealieFoodId = mealieFoodIdByGrocyProductId.get(grocyProductId);
    const food = mealieFoodId ? foodById.get(mealieFoodId) : undefined;
    const labelId = food?.labelId;
    const resolved = labelId && labelNameById.has(labelId) ? labelId : UNLABELED_ID;
    labelIdByGrocyProductId.set(grocyProductId, resolved);
  }

  return {
    builtAt: Date.now(),
    products,
    labelNameById,
    labelIdByGrocyProductId,
    stockByGrocyProductId: buildCurrentStockMap(currentStock),
  };
}

/** Same shape as scanner.ts's withTimeout: races the operation against a
 * timer and throws DeviceUpstreamTimeoutError (-> 504) on expiry. The
 * underlying network calls are not cancelled, only the wait — identical
 * caveat to the existing precedent in scanner.ts. */
async function withDeadline<T>(operation: Promise<T>, timeoutMs: number, upstream: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new DeviceUpstreamTimeoutError(upstream, timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function getSnapshot(deps: DeviceBrowseDeps): Promise<BrowseSnapshot> {
  if (cachedSnapshot && Date.now() - cachedSnapshot.builtAt < SNAPSHOT_TTL_MS) {
    return cachedSnapshot;
  }
  if (!inFlightBuild) {
    inFlightBuild = withDeadline(buildSnapshot(deps), SNAPSHOT_BUILD_TIMEOUT_MS, 'Browse snapshot build')
      .then(snapshot => {
        cachedSnapshot = snapshot;
        return snapshot;
      })
      .finally(() => {
        inFlightBuild = null;
      });
  }
  return inFlightBuild;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Truncate to at most `maxBytes` UTF-8 bytes without splitting a multi-byte
 * codepoint (backs off over continuation bytes 0x80-0xBF). */
function truncateUtf8(value: string, maxBytes: number): string {
  const buf = Buffer.from(value, 'utf8');
  if (buf.length <= maxBytes) {
    return value;
  }
  let end = maxBytes;
  while (end > 0 && (buf[end] & 0xc0) === 0x80) {
    end -= 1;
  }
  return buf.subarray(0, end).toString('utf8');
}

/** 'a'-'z' -> uppercase; anything else (digits, symbols, non-Latin, empty) -> '#'. */
function letterBucketFor(name: string): string {
  const first = normalizeMatchText(name).charAt(0);
  return first >= 'a' && first <= 'z' ? first.toUpperCase() : OTHER_LETTER;
}

function compareNormalizedNames(a: string, b: string): number {
  return normalizeMatchText(a).localeCompare(normalizeMatchText(b));
}

function clampLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
}

function clampOffset(offset: number | undefined): number {
  return Math.max(offset ?? 0, 0);
}

function paginate<T>(items: T[], offset: number, limit: number): { page: T[]; total: number; hasMore: boolean } {
  const total = items.length;
  const page = items.slice(offset, offset + limit);
  return { page, total, hasMore: offset + page.length < total };
}

// ---------------------------------------------------------------------------
// Use-cases
// ---------------------------------------------------------------------------

export async function listDeviceLabels(deps: DeviceBrowseDeps = defaultDeps): Promise<DeviceLabelListResult> {
  const snapshot = await getSnapshot(deps);

  const countByLabelId = new Map<string, number>();
  for (const product of snapshot.products) {
    if (!product.id) {
      continue;
    }
    const labelId = snapshot.labelIdByGrocyProductId.get(Number(product.id)) ?? UNLABELED_ID;
    countByLabelId.set(labelId, (countByLabelId.get(labelId) ?? 0) + 1);
  }

  const realBuckets: DeviceLabelBucket[] = [];
  for (const [labelId, count] of countByLabelId) {
    if (labelId === UNLABELED_ID || count <= 0) {
      continue;
    }
    const name = snapshot.labelNameById.get(labelId);
    if (name) {
      realBuckets.push({ id: labelId, name: truncateUtf8(name, MAX_NAME_BYTES), count });
    }
  }

  // Selection: top REAL_LABEL_CAP by product count desc, ties by name asc.
  const selected = realBuckets
    .sort((a, b) => (b.count - a.count) || compareNormalizedNames(a.name, b.name))
    .slice(0, REAL_LABEL_CAP);

  // Display order (applied after selection, the only sort rule for display):
  // name asc, case/diacritic-insensitive.
  selected.sort((a, b) => compareNormalizedNames(a.name, b.name));

  // Unlabeled is outside the ranked selection and the 19-slot cap entirely —
  // always appended last when non-empty, guaranteeing those products stay
  // reachable via label-browse.
  const unlabeledCount = countByLabelId.get(UNLABELED_ID) ?? 0;
  if (unlabeledCount > 0) {
    selected.push({ id: UNLABELED_ID, name: UNLABELED_NAME, count: unlabeledCount });
  }

  return { labels: selected };
}

export async function listDeviceLetters(deps: DeviceBrowseDeps = defaultDeps): Promise<DeviceLetterListResult> {
  const snapshot = await getSnapshot(deps);

  const countByLetter = new Map<string, number>();
  for (const product of snapshot.products) {
    if (!product.id || !product.name) {
      continue;
    }
    const letter = letterBucketFor(product.name);
    countByLetter.set(letter, (countByLetter.get(letter) ?? 0) + 1);
  }

  const letters: DeviceLetterBucket[] = [...LETTERS, OTHER_LETTER].map(letter => ({
    letter,
    count: countByLetter.get(letter) ?? 0,
  }));

  return { letters };
}

export interface ListDeviceProductsByLabelParams {
  labelId: string;
  offset?: number;
  limit?: number;
}

export async function listDeviceProductsByLabel(
  params: ListDeviceProductsByLabelParams,
  deps: DeviceBrowseDeps = defaultDeps,
): Promise<DeviceBrowseProductsResult> {
  const snapshot = await getSnapshot(deps);
  const offset = clampOffset(params.offset);
  const limit = clampLimit(params.limit);

  const matching = snapshot.products
    .filter(product => {
      if (!product.id) {
        return false;
      }
      const labelId = snapshot.labelIdByGrocyProductId.get(Number(product.id)) ?? UNLABELED_ID;
      return labelId === params.labelId;
    })
    .map(product => ({
      id: Number(product.id),
      name: truncateUtf8(product.name || 'Unknown', MAX_NAME_BYTES),
      stockAmount: snapshot.stockByGrocyProductId.get(Number(product.id)) ?? 0,
    }))
    .sort((a, b) => compareNormalizedNames(a.name, b.name) || (a.id - b.id));

  const { page, total, hasMore } = paginate(matching, offset, limit);
  return { results: page, total, offset, hasMore };
}

export interface ListDeviceProductsByLetterParams {
  letter: string;
  offset?: number;
  limit?: number;
}

export async function listDeviceProductsByLetter(
  params: ListDeviceProductsByLetterParams,
  deps: DeviceBrowseDeps = defaultDeps,
): Promise<DeviceBrowseProductsResult> {
  const snapshot = await getSnapshot(deps);
  const offset = clampOffset(params.offset);
  const limit = clampLimit(params.limit);
  const letter = params.letter.toUpperCase();

  const matching = snapshot.products
    .filter(product => product.id && product.name && letterBucketFor(product.name) === letter)
    .map(product => ({
      id: Number(product.id),
      name: truncateUtf8(product.name || 'Unknown', MAX_NAME_BYTES),
      stockAmount: snapshot.stockByGrocyProductId.get(Number(product.id)) ?? 0,
    }))
    .sort((a, b) => compareNormalizedNames(a.name, b.name) || (a.id - b.id));

  const { page, total, hasMore } = paginate(matching, offset, limit);
  return { results: page, total, offset, hasMore };
}

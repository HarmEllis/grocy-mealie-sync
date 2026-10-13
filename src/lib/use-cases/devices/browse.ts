/**
 * Use-cases behind the device "Bladeren" (browse) API: browse products by
 * Mealie label or by an A-Z index. See docs/DEVICE-API.md (firmware repo) for
 * the wire contract. Responses stay flat, target < 2 KB for realistic
 * households, and must never serialize past the firmware's hard 4096-byte
 * MAX_RESPONSE buffer, measured as encoded UTF-8 JSON bytes including
 * escaping (larger bodies are cut off and fail to parse on the device).
 *
 * Worst-case budget enforced below: every name is at most 96 encoded bytes,
 * every integer field (ids, counts, total, offset) is a safe integer (<= 16
 * characters), and stockAmount is a finite number (<= 24 characters,
 * e.g. -1.7976931348623157e+308). That bounds a 20-item product page at ~3.5
 * KB and the 19+1 label list at ~3.5 KB; the tests assert the serialized size
 * for boundary fixtures.
 */

import { db } from '@/lib/db';
import { productMappings } from '@/lib/db/schema';
import { normalizeMatchText } from '@/lib/fuzzy-match';
import { getCurrentStock, getGrocyEntities, type CurrentStockResponse, type Product } from '@/lib/grocy/types';
import { GroupsMultiPurposeLabelsService, RecipesFoodsService, type CancelablePromise } from '@/lib/mealie';
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
 * and capped so the response stays under the firmware's 4096-byte
 * MAX_RESPONSE (see the budget in the header); `unlabeled` is always appended
 * as an extra item outside this cap so unlabeled products stay reachable via
 * label-browse regardless of how many other labels exist.
 */
const REAL_LABEL_CAP = 19;

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
/** Products whose normalized name doesn't start with a-z land here. */
const OTHER_LETTER = '#';

const DRAIN_PAGE_SIZE = 500;
const SNAPSHOT_TTL_MS = 30_000;
/* How long one request waits for the snapshot. Leaves margin under the
 * firmware's fixed 8s HTTP timeout for the request round-trip itself. A
 * request that gives up does not stop the build: it keeps running as the one
 * shared build and caches its result, so a retry can reuse that work instead
 * of starting an overlapping build. */
const SNAPSHOT_BUILD_TIMEOUT_MS = 6_000;
/* A build still running after this long is abandoned: its page loops stop
 * before the next page, its in-flight Mealie request is cancelled, and the
 * next request starts a fresh build instead of waiting on a hung one. */
const SNAPSHOT_BUILD_ABANDON_MS = 60_000;

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 20;

/* Matches the firmware's API_NAME_LEN (64 bytes incl. NUL, so 63 usable):
 * the decoded UTF-8 size of any externally-sourced name (Mealie label,
 * Grocy product) the device has to store. */
const MAX_NAME_BYTES = 63;
/* The decoded cap alone does not bound the wire size, because JSON escaping
 * grows characters. Control characters are stripped first, leaving only `"`
 * and `\` to escape (2 bytes each), and every name is also capped at this
 * many bytes as it appears inside the serialized JSON string. */
const MAX_ENCODED_NAME_BYTES = 96;
const FALLBACK_PRODUCT_NAME = 'Unknown';

/* C0 controls, DEL and C1 controls: escaped (C0) or meaningless on the
 * device display (DEL, C1). */
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]+/g;

/* Matches the firmware's API_LABEL_ID_LEN (40 bytes incl. NUL, so 39 usable).
 * The device echoes the id back as the `labelId` query parameter, so it must
 * also need no JSON escaping or URL encoding. Mealie label ids are UUIDs. */
const LABEL_ID_PATTERN = /^[A-Za-z0-9_-]{1,39}$/;

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
  /** Paginated; must stop paging once `signal` is aborted. */
  listMealieFoods: (signal: AbortSignal) => Promise<DeviceBrowseMealieFood[]>;
  /** Paginated; must stop paging once `signal` is aborted. */
  listMealieLabels: (signal: AbortSignal) => Promise<MultiPurposeLabelSummary[]>;
  getCurrentStock: () => Promise<CurrentStockResponse[]>;
}

/**
 * Drain every page of a Mealie list endpoint. Mirrors the precedent in
 * src/lib/use-cases/units/manage.ts (listAllMealieShoppingItems /
 * listAllMealieRecipeSummaries): fixed page size, stop once a page comes back
 * shorter than requested. This is robust even if `total_pages` is absent or
 * wrong, unlike relying on a single very-large `perPage` request. Once
 * `signal` is aborted no further page is requested.
 */
export async function drainPages<TItem>(
  fetchPage: (page: number, perPage: number) => Promise<{ items?: TItem[] }>,
  signal?: AbortSignal,
): Promise<TItem[]> {
  const items: TItem[] = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    signal?.throwIfAborted();
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

/** Await a generated-client request, cancelling it when `signal` aborts.
 * A request that fails because of the abort rejects with the abort reason
 * (e.g. the abandonment timeout, a 504) rather than the client's generic
 * CancelError. */
export async function cancelOnAbort<T>(request: CancelablePromise<T>, signal: AbortSignal): Promise<T> {
  const cancel = () => request.cancel();
  if (signal.aborted) {
    cancel();
  }
  signal.addEventListener('abort', cancel, { once: true });
  try {
    return await request;
  } catch (error) {
    signal.throwIfAborted();
    throw error;
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}

async function fetchAllMealieLabels(signal: AbortSignal): Promise<MultiPurposeLabelSummary[]> {
  return drainPages(async (page, perPage) => {
    const response = await cancelOnAbort(GroupsMultiPurposeLabelsService.getAllApiGroupsLabelsGet(
      undefined,
      undefined,
      undefined,
      'asc',
      undefined,
      undefined,
      page,
      perPage,
    ), signal);
    return { items: response.items };
  }, signal);
}

async function fetchAllMealieFoods(signal: AbortSignal): Promise<DeviceBrowseMealieFood[]> {
  const rawFoods = await drainPages(async (page, perPage) => {
    const response = await cancelOnAbort(RecipesFoodsService.getAllApiFoodsGet(
      undefined,
      undefined,
      undefined,
      'asc',
      undefined,
      undefined,
      page,
      perPage,
    ), signal);
    return { items: response.items };
  }, signal);

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
// At most one build runs at a time: concurrent callers, and callers arriving
// after an earlier caller's deadline expired, all wait on the same build.
// ---------------------------------------------------------------------------

/** One Grocy product as the device sees it, computed once per snapshot so
 * labels, letters and both product lists agree on name, bucket and stock. */
interface BrowseEntry {
  id: number;
  /** Device-safe display name (see toDeviceName); also the sort key. */
  name: string;
  letter: string;
  /** A real, registered label id or UNLABELED_ID. */
  labelId: string;
  stockAmount: number;
}

interface BrowseSnapshot {
  builtAt: number;
  /** Only Grocy products with a positive safe-integer id. */
  entries: BrowseEntry[];
  /** Only labels the device can address (see isDeviceLabelId) with a
   * non-empty device-safe name, keyed by id, values already device-safe. */
  labelNameById: Map<string, string>;
}

let cachedSnapshot: BrowseSnapshot | null = null;
let inFlightBuild: { promise: Promise<BrowseSnapshot>; controller: AbortController } | null = null;

/**
 * Force the next browse call to rebuild the snapshot instead of serving a
 * cached one. Not wired to any mutation path yet in v1 (the 30s TTL bounds
 * staleness); exported as an integration point for a follow-up.
 */
export function invalidateBrowseSnapshot(): void {
  cachedSnapshot = null;
  inFlightBuild?.controller.abort();
  inFlightBuild = null;
}

function buildCurrentStockMap(currentStock: CurrentStockResponse[]): Map<number, number> {
  return new Map(currentStock.map(entry => {
    const amount = Number(entry.amount_aggregated ?? entry.amount ?? 0);
    return [Number(entry.product_id), Number.isFinite(amount) ? amount : 0];
  }));
}

function toGrocyProductId(id: Product['id']): number | null {
  const value = Number(id);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function isDeviceLabelId(id: string): boolean {
  return LABEL_ID_PATTERN.test(id) && id !== UNLABELED_ID;
}

async function buildSnapshot(deps: DeviceBrowseDeps, signal: AbortSignal): Promise<BrowseSnapshot> {
  const [products, mappings, foods, labels, currentStock] = await Promise.all([
    deps.listGrocyProducts(),
    deps.listProductMappings(),
    deps.listMealieFoods(signal),
    deps.listMealieLabels(signal),
    deps.getCurrentStock(),
  ]);

  // A label the device cannot address (over-long or unsafe id, or the
  // reserved UNLABELED_ID sentinel) or that has no printable name is treated
  // as nonexistent, so its products fall back to the synthetic unlabeled
  // bucket below and stay reachable.
  const labelNameById = new Map<string, string>();
  for (const label of labels) {
    const name = toDeviceName(label.name);
    if (isDeviceLabelId(label.id) && name) {
      labelNameById.set(label.id, name);
    }
  }
  const foodById = new Map(foods.map(food => [food.id, food]));
  const mealieFoodIdByGrocyProductId = new Map(mappings.map(m => [m.grocyProductId, m.mealieFoodId]));
  const stockByGrocyProductId = buildCurrentStockMap(currentStock);

  // Every valid Grocy product resolves to exactly one bucket: mapping ->
  // existing food -> registered label, else unlabeled. This also covers a
  // stale mapping (deleted food) and a food whose labelId no longer exists
  // among the fetched labels, not just "no mapping".
  const entries: BrowseEntry[] = [];
  for (const product of products) {
    const id = toGrocyProductId(product.id);
    if (id === null) {
      continue;
    }
    const mealieFoodId = mealieFoodIdByGrocyProductId.get(id);
    const food = mealieFoodId ? foodById.get(mealieFoodId) : undefined;
    const foodLabelId = food?.labelId;
    const name = toDeviceName(product.name) || FALLBACK_PRODUCT_NAME;
    entries.push({
      id,
      name,
      letter: letterBucketFor(name),
      labelId: foodLabelId && labelNameById.has(foodLabelId) ? foodLabelId : UNLABELED_ID,
      stockAmount: stockByGrocyProductId.get(id) ?? 0,
    });
  }
  entries.sort((a, b) => compareNormalizedNames(a.name, b.name) || (a.id - b.id));

  return {
    builtAt: Date.now(),
    entries,
    labelNameById,
  };
}

/** Same shape as scanner.ts's withTimeout: races the operation against a
 * timer and throws DeviceUpstreamTimeoutError (-> 504) on expiry. Only the
 * wait ends; the shared build keeps running (see startSnapshotBuild). */
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

function startSnapshotBuild(deps: DeviceBrowseDeps): NonNullable<typeof inFlightBuild> {
  const controller = new AbortController();
  const abandonTimer = setTimeout(() => {
    controller.abort(new DeviceUpstreamTimeoutError('Browse snapshot build', SNAPSHOT_BUILD_ABANDON_MS));
  }, SNAPSHOT_BUILD_ABANDON_MS);
  abandonTimer.unref?.();

  const build: NonNullable<typeof inFlightBuild> = {
    controller,
    promise: buildSnapshot(deps, controller.signal)
      .then(snapshot => {
        // An abandoned or invalidated build no longer owns the slot and must
        // not overwrite what a newer build caches.
        if (inFlightBuild === build) {
          cachedSnapshot = snapshot;
        }
        return snapshot;
      })
      .catch((error: unknown) => {
        // Stop the sibling page loops of a build that already failed.
        controller.abort(error);
        throw error;
      })
      .finally(() => {
        clearTimeout(abandonTimer);
        if (inFlightBuild === build) {
          inFlightBuild = null;
        }
      }),
  };
  controller.signal.addEventListener('abort', () => {
    if (inFlightBuild === build) {
      inFlightBuild = null;
    }
  }, { once: true });
  return build;
}

async function getSnapshot(deps: DeviceBrowseDeps): Promise<BrowseSnapshot> {
  if (cachedSnapshot && Date.now() - cachedSnapshot.builtAt < SNAPSHOT_TTL_MS) {
    return cachedSnapshot;
  }
  inFlightBuild ??= startSnapshotBuild(deps);
  return withDeadline(inFlightBuild.promise, SNAPSHOT_BUILD_TIMEOUT_MS, 'Browse snapshot build');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Make an externally-sourced name safe for the device: well-formed (a lone
 * UTF-16 surrogate becomes U+FFFD instead of a 6-byte `\udXXX` escape),
 * control characters replaced by a single space, and truncated on a code
 * point boundary to at most MAX_NAME_BYTES decoded UTF-8 bytes and at most
 * MAX_ENCODED_NAME_BYTES bytes inside a serialized JSON string. Returns ''
 * when nothing printable is left; callers pick the fallback.
 */
export function toDeviceName(raw: string | null | undefined): string {
  const cleaned = Buffer.from(raw ?? '', 'utf8').toString('utf8')
    .replace(CONTROL_CHARS, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();

  let decodedBytes = 0;
  let encodedBytes = 0;
  let result = '';
  for (const char of cleaned) {
    const charBytes = Buffer.byteLength(char, 'utf8');
    // JSON.stringify(char) adds the two surrounding quotes.
    const charEncodedBytes = Buffer.byteLength(JSON.stringify(char), 'utf8') - 2;
    if (decodedBytes + charBytes > MAX_NAME_BYTES || encodedBytes + charEncodedBytes > MAX_ENCODED_NAME_BYTES) {
      break;
    }
    decodedBytes += charBytes;
    encodedBytes += charEncodedBytes;
    result += char;
  }
  return result.trimEnd();
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

function toProductRef(entry: BrowseEntry): DeviceBrowseProductsResult['results'][number] {
  return { id: entry.id, name: entry.name, stockAmount: entry.stockAmount };
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
  for (const entry of snapshot.entries) {
    countByLabelId.set(entry.labelId, (countByLabelId.get(entry.labelId) ?? 0) + 1);
  }

  const realBuckets: DeviceLabelBucket[] = [];
  for (const [labelId, count] of countByLabelId) {
    if (labelId === UNLABELED_ID || count <= 0) {
      continue;
    }
    const name = snapshot.labelNameById.get(labelId);
    if (name) {
      realBuckets.push({ id: labelId, name, count });
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
  for (const entry of snapshot.entries) {
    countByLetter.set(entry.letter, (countByLetter.get(entry.letter) ?? 0) + 1);
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

  const matching = snapshot.entries
    .filter(entry => entry.labelId === params.labelId)
    .map(toProductRef);

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

  const matching = snapshot.entries
    .filter(entry => entry.letter === letter)
    .map(toProductRef);

  const { page, total, hasMore } = paginate(matching, offset, limit);
  return { results: page, total, offset, hasMore };
}

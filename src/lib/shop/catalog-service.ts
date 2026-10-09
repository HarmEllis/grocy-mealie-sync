import { getInstallation, listInstallations } from '../plugins/installations';
import { getPluginGateway } from '../plugins/runtime';
import type { PluginGateway } from '../plugins/gateway';
import type { RetailerProduct } from '../plugins/protocol/v1';
import { pluginCallErrorSchema } from './api-helpers';
import { getRetailerProduct, listRetailerProducts, upsertRetailerProducts, type RetailerProductRow } from './retailer-catalog';

/**
 * Catalogue access shared by the UI, MCP and mapping validation. Live plugin
 * results are cached briefly and identical concurrent searches share one
 * plugin call. Every live result is merged into the persistent catalogue, and
 * stored products matching the query are always returned as well, so a
 * disconnected plugin still offers known products, marked `offline`.
 */

export const CATALOG_SEARCH_TTL_MS = 60_000;
const CATALOG_CACHE_LIMIT = 200;
const SAVED_RESULT_LIMIT = 50;
const SEARCH_TIMEOUT_MS = 20_000;
const REFRESH_TIMEOUT_MS = 10_000;

/** One product as offered for mapping: persisted catalogue data plus where it came from. */
export interface CatalogProductView {
  /** Retailer product ID (the persisted `externalId`). */
  id: string;
  externalId: string;
  name: string;
  brand?: string;
  gtins?: string[];
  packageAmount?: number;
  packageUnit?: string;
  measure: 'unit' | 'weight';
  availability: 'available' | 'temporarily_unavailable' | 'discontinued' | 'unknown';
  /** ISO timestamp of the last known availability statement, or null when never checked. */
  availabilityCheckedAt: string | null;
  /** Returned by the plugin for this query (fresh or from the short cache). */
  live: boolean;
  /** Stored in the persistent catalogue. Always true after a live result was merged. */
  saved: boolean;
}

export type CatalogSource = 'live' | 'cached' | 'offline';

export interface CatalogSearchResult {
  providerId: string;
  /** `live`: fetched now; `cached`: a live result younger than the cache TTL; `offline`: stored products only. */
  status: CatalogSource;
  /** Safe explanation when `status` is `offline`. */
  message?: string;
  /** When the live part of the result was fetched; null when offline. */
  fetchedAt: string | null;
  products: CatalogProductView[];
}

interface CacheEntry {
  at: number;
  products: RetailerProduct[];
}

declare global {
  // Shared across Next.js bundles like the gateway itself.
  // eslint-disable-next-line no-var
  var __gmsShopCatalogCache: { entries: Map<string, CacheEntry>; inflight: Map<string, Promise<RetailerProduct[]>> } | undefined;
}

function cache() {
  globalThis.__gmsShopCatalogCache ??= { entries: new Map(), inflight: new Map() };
  return globalThis.__gmsShopCatalogCache;
}

/** Test hook and reset point after a binding reset. */
export function clearCatalogSearchCache(): void {
  const current = cache();
  current.entries.clear();
  current.inflight.clear();
}

export function normalizeCatalogQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

function toView(row: RetailerProductRow, live: boolean): CatalogProductView {
  let gtins: string[] | undefined;
  try {
    const parsed = row.gtinsJson ? JSON.parse(row.gtinsJson) : undefined;
    gtins = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : undefined;
  } catch {
    gtins = undefined;
  }
  const availability = (['available', 'temporarily_unavailable', 'discontinued'] as const).find(value => value === row.availability) ?? 'unknown';
  return {
    id: row.externalId,
    externalId: row.externalId,
    name: row.name,
    ...(row.brand ? { brand: row.brand } : {}),
    ...(gtins?.length ? { gtins } : {}),
    ...(row.packageAmount ? { packageAmount: row.packageAmount } : {}),
    ...(row.packageUnit ? { packageUnit: row.packageUnit } : {}),
    measure: row.measure === 'weight' ? 'weight' : 'unit',
    availability,
    availabilityCheckedAt: row.availabilityCheckedAt?.toISOString() ?? null,
    live,
    saved: true,
  };
}

/** Stored products whose name, brand or ID contains every query word. */
export function savedCatalogMatches(providerId: string, query: string, limit = SAVED_RESULT_LIMIT): RetailerProductRow[] {
  const words = normalizeCatalogQuery(query).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  return listRetailerProducts(providerId)
    .filter((row) => {
      const haystack = `${row.name} ${row.brand ?? ''} ${row.externalId}`.toLowerCase();
      return words.every(word => haystack.includes(word));
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}

const SAVED_ONLY = 'Showing saved products only.';

/** A safe reason for a failed catalogue call. Plugin messages are user-facing text by contract. */
function safeFailureMessage(error: unknown): string {
  const parsed = pluginCallErrorSchema.safeParse(error);
  if (!parsed.success) return 'The catalogue request failed.';
  if (parsed.data.code === 'NOT_CONNECTED') return 'The plugin is not connected.';
  if (parsed.data.code === 'UNAUTHENTICATED') return 'The retailer account is signed out.';
  if (parsed.data.code === 'NOT_SUPPORTED') return 'This plugin does not offer this catalogue request.';
  return parsed.data.message;
}

async function liveSearch(gateway: PluginGateway, installationId: string, identity: string, query: string, refresh: boolean, nowMs: number): Promise<{ products: RetailerProduct[]; cached: boolean; at: number }> {
  const state = cache();
  // Keyed by session and retailer account: results of another sign-in are never reused.
  const key = JSON.stringify([installationId, identity, normalizeCatalogQuery(query)]);
  const hit = state.entries.get(key);
  if (!refresh && hit && nowMs - hit.at < CATALOG_SEARCH_TTL_MS) return { products: hit.products, cached: true, at: hit.at };
  let pending = state.inflight.get(key);
  if (!pending) {
    pending = gateway.call(installationId, 'catalog.search', { query }, { timeoutMs: SEARCH_TIMEOUT_MS })
      .then(result => result.products)
      .finally(() => state.inflight.delete(key));
    state.inflight.set(key, pending);
  }
  const products = await pending;
  const at = Date.now();
  state.entries.delete(key);
  state.entries.set(key, { at, products });
  while (state.entries.size > CATALOG_CACHE_LIMIT) state.entries.delete(state.entries.keys().next().value!);
  return { products, cached: false, at };
}

/**
 * Search one installation's catalogue. Live results are persisted before they
 * are returned; stored matches follow them. Never throws for plugin failures:
 * those return `status: 'offline'` with the stored matches.
 */
export async function searchCatalog(installationId: string, query: string, options: { refresh?: boolean; now?: Date } = {}): Promise<CatalogSearchResult | null> {
  const installation = getInstallation(installationId);
  if (!installation?.providerId) return null;
  const providerId = installation.providerId;
  const now = options.now ?? new Date();
  const gateway = getPluginGateway();
  let live: RetailerProduct[] = [];
  let status: CatalogSource = 'offline';
  let message: string | undefined;
  let fetchedAt: string | null = null;
  const session = gateway?.getSession(installationId);
  if (gateway && session) {
    try {
      const identity = `${session.sessionId}:${session.hello.accountKey ?? 'signed-out'}:${session.hello.authState}`;
      const result = await liveSearch(gateway, installationId, identity, query, Boolean(options.refresh), now.getTime());
      live = result.products;
      status = result.cached ? 'cached' : 'live';
      fetchedAt = new Date(result.at).toISOString();
      if (!result.cached) upsertRetailerProducts(providerId, live, now);
    } catch (error) {
      message = `${safeFailureMessage(error)} ${SAVED_ONLY}`;
    }
  } else {
    message = `The plugin is not connected. ${SAVED_ONLY}`;
  }
  const seen = new Set<string>();
  const products: CatalogProductView[] = [];
  for (const product of live) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    const row = getRetailerProduct(providerId, product.id);
    if (row) products.push(toView(row, true));
  }
  for (const row of savedCatalogMatches(providerId, query)) {
    if (seen.has(row.externalId)) continue;
    seen.add(row.externalId);
    products.push(toView(row, false));
  }
  return { providerId, status, ...(message ? { message } : {}), fetchedAt, products };
}

export interface CatalogRefreshResult {
  providerId: string;
  status: 'refreshed' | 'offline';
  message?: string;
  installationId: string | null;
  products: CatalogProductView[];
  /** Requested IDs the plugin did not return. Their stored availability is kept: omission is not proof. */
  missing: string[];
}

/** A connected, signed-in installation of the provider that offers `catalog`. */
export function catalogInstallationFor(providerId: string, preferredInstallationId?: string): string | null {
  const gateway = getPluginGateway();
  if (!gateway) return null;
  const candidates = listInstallations()
    .filter(installation => installation.providerId === providerId && !installation.revokedAt)
    .sort((a, b) => (a.id === preferredInstallationId ? -1 : b.id === preferredInstallationId ? 1 : a.createdAt.getTime() - b.createdAt.getTime()));
  for (const installation of candidates) {
    const session = gateway.getSession(installation.id);
    if (session?.hello.capabilities.includes('catalog') && session.hello.authState === 'authenticated') return installation.id;
  }
  return null;
}

/**
 * Re-read products with `catalog.get` so their package data and availability
 * are current. Failures leave the stored data untouched and report `offline`.
 */
export async function refreshCatalogProducts(providerId: string, ids: string[], options: { installationId?: string; now?: Date } = {}): Promise<CatalogRefreshResult> {
  const unique = [...new Set(ids)].slice(0, 200);
  const now = options.now ?? new Date();
  const installationId = catalogInstallationFor(providerId, options.installationId);
  const views = () => unique.flatMap(id => {
    const row = getRetailerProduct(providerId, id);
    return row ? [toView(row, false)] : [];
  });
  if (!installationId || unique.length === 0) {
    return { providerId, status: 'offline', message: 'No connected, signed-in plugin can check this retailer right now.', installationId: null, products: views(), missing: [] };
  }
  try {
    const result = await getPluginGateway()!.call(installationId, 'catalog.get', { ids: unique }, { timeoutMs: REFRESH_TIMEOUT_MS });
    const requested = new Set(unique);
    const returned = result.products.filter(product => requested.has(product.id));
    upsertRetailerProducts(providerId, returned, now);
    const returnedIds = new Set(returned.map(product => product.id));
    return {
      providerId,
      status: 'refreshed',
      installationId,
      products: unique.flatMap(id => {
        const row = getRetailerProduct(providerId, id);
        return row ? [toView(row, returnedIds.has(id))] : [];
      }),
      missing: unique.filter(id => !returnedIds.has(id)),
    };
  } catch (error) {
    return { providerId, status: 'offline', message: safeFailureMessage(error), installationId, products: views(), missing: [] };
  }
}

export { toView as catalogProductView };

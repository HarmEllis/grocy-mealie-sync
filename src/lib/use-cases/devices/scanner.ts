/**
 * Use-cases behind the device API (`/api/device/v1/*`) consumed by the
 * grocy-mealie-scanner firmware. The contract lives in that repo's
 * docs/DEVICE-API.md; responses here must stay small and flat because the
 * device parses them with cJSON on a memory-constrained MCU.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { productMappings, unitMappings } from '@/lib/db/schema';
import { rankVariantMatches } from '@/lib/fuzzy-match';
import { ApiError, StockByBarcodeService } from '@/lib/grocy';
import {
  createGrocyEntity,
  getGrocyEntities,
  getProductDetails,
  type Product,
  type ProductBarcode,
  type ProductDetailsResponse,
  type QuantityUnit,
} from '@/lib/grocy/types';
import { resolveDefaultUnit } from '@/lib/settings';
import { addStock, consumeStock, defaultInventoryDeps, markStockOpened } from '@/lib/use-cases/inventory/manage';
import { createProductInGrocy } from '@/lib/use-cases/products/manage';
import {
  DEVICE_SYNC_LOCK_MAX_WAIT_MS,
  defaultSyncLockDeps,
  noopSyncLockDeps,
  runWithSyncLock,
  type SyncLockDeps,
} from '@/lib/use-cases/shared/sync-lock';
import { addShoppingListItem, checkShoppingListProduct } from '@/lib/use-cases/shopping/list';

export const DEVICE_BARCODE_PATTERN = /^[0-9A-Za-z_-]{4,64}$/;

const EXTERNAL_LOOKUP_TIMEOUT_MS = 3_000;
const MAX_SUGGESTED_MATCHES = 5;

// ---------------------------------------------------------------------------
// Errors — routes translate these into HTTP statuses
// ---------------------------------------------------------------------------

/** Maps to 404 (unknown product id). */
export class DeviceProductNotFoundError extends Error {
  constructor(productId: number) {
    super(`Unknown product id: ${productId}`);
    this.name = 'DeviceProductNotFoundError';
  }
}

/** Maps to 409; `payload` is merged into the error response body. */
export class DeviceConflictError extends Error {
  constructor(message: string, public readonly payload: Record<string, unknown> = {}) {
    super(message);
    this.name = 'DeviceConflictError';
  }
}

// ---------------------------------------------------------------------------
// Response shapes (mirror docs/DEVICE-API.md)
// ---------------------------------------------------------------------------

export interface DeviceProduct {
  id: number;
  name: string;
  quantityUnit: string;
  stockAmount: number;
  openedAmount: number;
  minStockAmount: number;
  onShoppingList: boolean;
}

export interface DeviceExternalLookup {
  source: 'openfoodfacts';
  name: string;
  brand: string | null;
  quantity: string | null;
}

export interface DeviceSuggestedMatch {
  id: number;
  name: string;
  score: number;
}

export type DeviceScanResult =
  | { status: 'found'; product: DeviceProduct }
  | {
      status: 'unknown';
      barcode: string;
      externalLookup: DeviceExternalLookup | null;
      suggestedMatches: DeviceSuggestedMatch[];
    };

export type DeviceAction = 'purchase' | 'open' | 'consume' | 'add_to_shopping_list';

export interface DeviceActionResult {
  ok: true;
  action: DeviceAction;
  product: { id: number; name: string };
  stock: { before: number; after: number };
  opened: { before: number; after: number };
  shoppingList: { itemId: string; quantity: number } | null;
}

export interface DeviceSearchResult {
  results: Array<{ id: number; name: string; stockAmount: number }>;
}

// ---------------------------------------------------------------------------
// Dependencies (injected for tests)
// ---------------------------------------------------------------------------

export interface DeviceScannerDeps extends SyncLockDeps {
  getStockByBarcode: (barcode: string) => Promise<ProductDetailsResponse>;
  getProductDetails: (productId: number) => Promise<ProductDetailsResponse>;
  listGrocyProducts: () => Promise<Product[]>;
  listProductBarcodes: () => Promise<ProductBarcode[]>;
  listGrocyUnits: () => Promise<QuantityUnit[]>;
  createProductBarcode: (body: { product_id: number; barcode: string }) => Promise<{ created_object_id?: number }>;
  lookupExternalBarcode: (barcode: string) => Promise<DeviceExternalLookup | null>;
  findMealieFoodIdForGrocyProduct: (grocyProductId: number) => Promise<string | null>;
  checkShoppingListProduct: typeof checkShoppingListProduct;
  addShoppingListItem: typeof addShoppingListItem;
  addStock: typeof addStock;
  consumeStock: typeof consumeStock;
  markStockOpened: typeof markStockOpened;
  createProductInGrocy: typeof createProductInGrocy;
  resolveDefaultGrocyUnitId: () => Promise<number | null>;
}

async function lookupOpenFoodFacts(barcode: string): Promise<DeviceExternalLookup | null> {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,quantity`,
      {
        signal: AbortSignal.timeout(EXTERNAL_LOOKUP_TIMEOUT_MS),
        headers: { 'User-Agent': 'grocy-mealie-sync (device API barcode lookup)' },
      },
    );
    if (!response.ok) {
      return null;
    }
    const data = await response.json() as {
      product?: { product_name?: string; brands?: string; quantity?: string };
    };
    const name = data.product?.product_name?.trim();
    if (!name) {
      return null;
    }
    return {
      source: 'openfoodfacts',
      name,
      brand: data.product?.brands?.split(',')[0]?.trim() || null,
      quantity: data.product?.quantity?.trim() || null,
    };
  } catch {
    // Timeouts and network errors degrade to "no external data"; the device
    // flow works without it.
    return null;
  }
}

async function findMealieFoodIdForGrocyProduct(grocyProductId: number): Promise<string | null> {
  const rows = await db
    .select({ mealieFoodId: productMappings.mealieFoodId })
    .from(productMappings)
    .where(eq(productMappings.grocyProductId, grocyProductId))
    .limit(1);
  return rows[0]?.mealieFoodId ?? null;
}

async function resolveDefaultGrocyUnitId(): Promise<number | null> {
  const allUnitMappings = await db
    .select({ id: unitMappings.id, grocyUnitId: unitMappings.grocyUnitId })
    .from(unitMappings);
  const resolved = await resolveDefaultUnit(allUnitMappings);
  return resolved?.grocyUnitId ?? null;
}

// performDeviceAction already holds the sync lock around the whole action, so
// the inventory mutations it delegates to must not try to re-acquire the
// (non-reentrant) lock — hand them a no-op lock instead.
const lockedInventoryDeps = { ...defaultInventoryDeps, ...noopSyncLockDeps };

const defaultDeps: DeviceScannerDeps = {
  ...defaultSyncLockDeps,
  getStockByBarcode: barcode => StockByBarcodeService.getStockProductsByBarcode(barcode),
  getProductDetails,
  listGrocyProducts: () => getGrocyEntities('products'),
  listProductBarcodes: () => getGrocyEntities('product_barcodes'),
  listGrocyUnits: () => getGrocyEntities('quantity_units'),
  createProductBarcode: body => createGrocyEntity('product_barcodes', body),
  lookupExternalBarcode: lookupOpenFoodFacts,
  findMealieFoodIdForGrocyProduct,
  checkShoppingListProduct,
  addShoppingListItem,
  addStock: params => addStock(params, lockedInventoryDeps),
  consumeStock: params => consumeStock(params, lockedInventoryDeps),
  markStockOpened: params => markStockOpened(params, lockedInventoryDeps),
  createProductInGrocy,
  resolveDefaultGrocyUnitId,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isGrocyBadRequest(error: unknown): boolean {
  return error instanceof ApiError && error.status === 400;
}

async function isOnShoppingList(grocyProductId: number, deps: DeviceScannerDeps): Promise<boolean> {
  const mealieFoodId = await deps.findMealieFoodIdForGrocyProduct(grocyProductId);
  if (!mealieFoodId) {
    return false;
  }
  try {
    const check = await deps.checkShoppingListProduct({ foodId: mealieFoodId });
    return check.alreadyOnList;
  } catch {
    // Shopping list state is cosmetic on the product screen; never fail the
    // scan because Mealie is unreachable.
    return false;
  }
}

async function toDeviceProduct(
  details: ProductDetailsResponse,
  deps: DeviceScannerDeps,
): Promise<DeviceProduct> {
  const id = Number(details.product?.id ?? 0);
  return {
    id,
    name: details.product?.name ?? 'Unknown',
    quantityUnit: details.quantity_unit_stock?.name ?? '',
    stockAmount: Number(details.stock_amount ?? 0),
    openedAmount: Number(details.stock_amount_opened ?? 0),
    minStockAmount: Number(details.product?.min_stock_amount ?? 0),
    onShoppingList: await isOnShoppingList(id, deps),
  };
}

async function getProductDetailsOr404(
  productId: number,
  deps: DeviceScannerDeps,
): Promise<ProductDetailsResponse> {
  try {
    return await deps.getProductDetails(productId);
  } catch (error) {
    if (isGrocyBadRequest(error)) {
      throw new DeviceProductNotFoundError(productId);
    }
    throw error;
  }
}

function suggestMatches(
  products: Product[],
  externalLookup: DeviceExternalLookup | null,
  barcode: string,
): DeviceSuggestedMatch[] {
  const queries = [{ text: barcode }];
  if (externalLookup) {
    queries.push({ text: externalLookup.name });
    if (externalLookup.brand) {
      queries.push({ text: `${externalLookup.brand} ${externalLookup.name}` });
    }
  }

  const matches = rankVariantMatches(
    queries,
    products.filter(product => product.id && product.name),
    product => [{ text: product.name! }],
    0.3,
    MAX_SUGGESTED_MATCHES,
  );

  return matches.map(match => ({
    id: Number(match.item.id),
    name: match.item.name!,
    score: Math.round(match.score * 100) / 100,
  }));
}

// ---------------------------------------------------------------------------
// Use-cases
// ---------------------------------------------------------------------------

export async function scanDeviceBarcode(
  barcode: string,
  deps: DeviceScannerDeps = defaultDeps,
): Promise<DeviceScanResult> {
  try {
    const details = await deps.getStockByBarcode(barcode);
    return { status: 'found', product: await toDeviceProduct(details, deps) };
  } catch (error) {
    if (!isGrocyBadRequest(error)) {
      throw error;
    }
  }

  // Grocy answers 400 for an unknown barcode → build the not-found flow.
  const [externalLookup, products] = await Promise.all([
    deps.lookupExternalBarcode(barcode),
    deps.listGrocyProducts().catch(() => [] as Product[]),
  ]);

  return {
    status: 'unknown',
    barcode,
    externalLookup,
    suggestedMatches: suggestMatches(products, externalLookup, barcode),
  };
}

export interface PerformDeviceActionParams {
  productId: number;
  action: DeviceAction;
  amount?: number;
}

export async function performDeviceAction(
  params: PerformDeviceActionParams,
  deps: DeviceScannerDeps = defaultDeps,
): Promise<DeviceActionResult> {
  const amount = params.amount ?? 1;
  if (!(amount > 0)) {
    throw new Error('Amount must be greater than 0.');
  }

  const productRef = `grocy:${params.productId}`;

  // add_to_shopping_list never mutates Grocy stock, so it stays outside the sync
  // lock (and away from Grocy's stock endpoints entirely).
  if (params.action === 'add_to_shopping_list') {
    const before = await getProductDetailsOr404(params.productId, deps);
    const stockBefore = Number(before.stock_amount ?? 0);
    const openedBefore = Number(before.stock_amount_opened ?? 0);
    const mealieFoodId = await deps.findMealieFoodIdForGrocyProduct(params.productId);
    // Without a mapping the grocy: ref lets addShoppingListItem resolve the
    // Mealie food itself (and produce a clear error when none is linked).
    const result = await deps.addShoppingListItem(
      mealieFoodId
        ? { foodId: mealieFoodId, quantity: amount }
        : { query: productRef, quantity: amount },
    );

    return {
      ok: true,
      action: params.action,
      product: { id: params.productId, name: before.product?.name ?? 'Unknown' },
      stock: { before: stockBefore, after: stockBefore },
      opened: { before: openedBefore, after: openedBefore },
      shoppingList: { itemId: result.item.id, quantity: Number(result.item.quantity ?? amount) },
    };
  }

  // Stock-mutating actions hold the sync lock across read, check and mutation so
  // a concurrent sync or scanner request cannot invalidate the insufficient-stock
  // check between the snapshot and the write.
  return runWithSyncLock(
    deps,
    async () => {
      const before = await getProductDetailsOr404(params.productId, deps);
      const productName = before.product?.name ?? 'Unknown';
      const stockBefore = Number(before.stock_amount ?? 0);
      const openedBefore = Number(before.stock_amount_opened ?? 0);

      switch (params.action) {
        case 'purchase':
          await deps.addStock({ productRef, amount });
          break;
        case 'open':
          if (amount > stockBefore - openedBefore) {
            throw new DeviceConflictError('Not enough in stock', {
              stock: { amount: stockBefore, opened: openedBefore },
            });
          }
          await deps.markStockOpened({ productRef, amount });
          break;
        case 'consume':
          if (amount > stockBefore) {
            throw new DeviceConflictError('Not enough in stock', {
              stock: { amount: stockBefore, opened: openedBefore },
            });
          }
          await deps.consumeStock({ productRef, amount });
          break;
      }

      const after = await getProductDetailsOr404(params.productId, deps);

      return {
        ok: true,
        action: params.action,
        product: { id: params.productId, name: productName },
        stock: { before: stockBefore, after: Number(after.stock_amount ?? 0) },
        opened: { before: openedBefore, after: Number(after.stock_amount_opened ?? 0) },
        shoppingList: null,
      };
    },
    { maxWaitMs: DEVICE_SYNC_LOCK_MAX_WAIT_MS },
  );
}

export interface SearchDeviceProductsParams {
  query: string;
  limit?: number;
}

export async function searchDeviceProducts(
  params: SearchDeviceProductsParams,
  deps: DeviceScannerDeps = defaultDeps,
): Promise<DeviceSearchResult> {
  const query = params.query.trim();
  if (!query) {
    throw new Error('Query must not be empty.');
  }
  const limit = Math.min(Math.max(params.limit ?? 8, 1), 25);

  const products = await deps.listGrocyProducts();
  const matches = rankVariantMatches(
    [{ text: query }],
    products.filter(product => product.id && product.name),
    product => [{ text: product.name! }],
    0.3,
    limit,
  );

  const results = await Promise.all(matches.map(async match => {
    const id = Number(match.item.id);
    let stockAmount = 0;
    try {
      const details = await deps.getProductDetails(id);
      stockAmount = Number(details.stock_amount ?? 0);
    } catch {
      // Stock display is informational; a lookup failure should not break search.
    }
    return { id, name: match.item.name!, stockAmount };
  }));

  return { results };
}

export interface CreateDeviceProductParams {
  name: string;
  barcode: string;
}

export async function createDeviceProduct(
  params: CreateDeviceProductParams,
  deps: DeviceScannerDeps = defaultDeps,
): Promise<DeviceProduct> {
  const name = params.name.trim();
  if (!name) {
    throw new Error('Name must not be empty.');
  }

  let grocyUnitId = await deps.resolveDefaultGrocyUnitId();
  if (grocyUnitId === null) {
    const units = await deps.listGrocyUnits();
    grocyUnitId = Number(units[0]?.id ?? 0) || null;
  }
  if (grocyUnitId === null) {
    throw new Error('No Grocy quantity units are available to create the product with.');
  }

  const created = await deps.createProductInGrocy({ name, grocyUnitId });
  if (!created.created) {
    throw new DeviceConflictError('Product already exists', {
      product: { id: created.grocyProductId, name: created.grocyProductName },
    });
  }
  if (!created.grocyProductId) {
    throw new Error('Grocy did not return an id for the created product.');
  }

  await deps.createProductBarcode({ product_id: created.grocyProductId, barcode: params.barcode });

  const details = await getProductDetailsOr404(created.grocyProductId, deps);
  return toDeviceProduct(details, deps);
}

export interface LinkDeviceBarcodeParams {
  productId: number;
  barcode: string;
}

export async function linkDeviceBarcode(
  params: LinkDeviceBarcodeParams,
  deps: DeviceScannerDeps = defaultDeps,
): Promise<DeviceProduct> {
  // 404 before any side effects when the target product does not exist.
  const details = await getProductDetailsOr404(params.productId, deps);

  const existing = (await deps.listProductBarcodes())
    .find(entry => entry.barcode === params.barcode);

  if (existing && Number(existing.product_id) !== params.productId) {
    const ownerId = Number(existing.product_id);
    let ownerName: string | null = null;
    try {
      ownerName = (await deps.getProductDetails(ownerId)).product?.name ?? null;
    } catch {
      // Owner lookup is best-effort; the conflict response works without it.
    }
    throw new DeviceConflictError('Barcode is already linked to another product', {
      product: { id: ownerId, name: ownerName },
    });
  }

  if (!existing) {
    await deps.createProductBarcode({ product_id: params.productId, barcode: params.barcode });
  }

  return toDeviceProduct(details, deps);
}

/**
 * Fetch a single product by id in the same flat shape as a scan "found" result.
 * Backs the device's home-screen search → pick flow, where the picked product
 * is shown exactly as if it had been scanned (no barcode to link). Throws
 * DeviceProductNotFoundError (→ 404) for an unknown id.
 */
export async function getDeviceProduct(
  productId: number,
  deps: DeviceScannerDeps = defaultDeps,
): Promise<DeviceProduct> {
  const details = await getProductDetailsOr404(productId, deps);
  return toDeviceProduct(details, deps);
}

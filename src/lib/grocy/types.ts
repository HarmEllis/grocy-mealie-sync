/**
 * Typed wrappers for Grocy GenericEntityInteractionsService and StockService.
 *
 * The generated Grocy client types `ExposedEntity_*` are all bare `string`
 * aliases, which forces callers to use `as any` on every entity name literal.
 * These wrappers contain the `as any` casts in a single place and expose
 * properly typed interfaces to the rest of the application.
 */

// Side-effect import: ensures OpenAPI.BASE and HEADERS are configured
// before any service call is made. Without this, imports that bypass
// the grocy/index.ts barrel would hit the placeholder 'xxx' base URL.
import './init';
import { GenericEntityInteractionsService, StockService } from './client';
import type { Product } from './client/models/Product';
import type { QuantityUnit } from './client/models/QuantityUnit';
import type { Location } from './client/models/Location';
import type { ShoppingListItem } from './client/models/ShoppingListItem';
import type { CurrentVolatilStockResponse } from './client/models/CurrentVolatilStockResponse';
import type { ProductDetailsResponse } from './client/models/ProductDetailsResponse';
import { StockTransactionType } from './client/models/StockTransactionType';

// ---------------------------------------------------------------------------
// Entity name unions
// ---------------------------------------------------------------------------

/** Entity names used for listing (getObjects). */
export type GrocyListableEntity =
  | 'products'
  | 'quantity_units'
  | 'locations'
  | 'shopping_list';

/** Entity names used for creation/editing (postObjects, putObjects). */
export type GrocyEditableEntity =
  | 'products'
  | 'quantity_units'
  | 'locations'
  | 'shopping_list';

/** Entity names used for deletion (deleteObjects). */
export type GrocyDeletableEntity =
  | 'products'
  | 'quantity_units'
  | 'locations'
  | 'shopping_list';

// ---------------------------------------------------------------------------
// Entity-to-type mapping
// ---------------------------------------------------------------------------

/** Maps entity name strings to their Grocy model types. */
interface GrocyEntityTypeMap {
  products: Product;
  quantity_units: QuantityUnit;
  locations: Location;
  shopping_list: ShoppingListItem;
}

// ---------------------------------------------------------------------------
// Request body types for entity creation
// ---------------------------------------------------------------------------

/** Fields accepted when creating a Grocy product. */
export interface CreateProductBody {
  name: string;
  min_stock_amount?: number;
  qu_id_purchase?: number;
  qu_id_stock?: number;
  location_id?: number;
}

/** Fields accepted when creating a Grocy quantity unit. */
export interface CreateQuantityUnitBody {
  name: string;
  name_plural?: string;
}

/** Fields accepted when updating a Grocy product (partial). */
export interface UpdateProductBody {
  name?: string;
  min_stock_amount?: number;
  qu_id_purchase?: number;
  qu_id_stock?: number;
  location_id?: number;
}

/** Fields accepted when updating a Grocy quantity unit (partial). */
export interface UpdateQuantityUnitBody {
  name?: string;
  name_plural?: string;
}

// ---------------------------------------------------------------------------
// Typed wrappers for GenericEntityInteractionsService
// ---------------------------------------------------------------------------

/**
 * Fetch all objects of a given Grocy entity.
 * Returns a properly typed array; returns `[]` when the raw response is not an array.
 */
export async function getGrocyEntities<E extends GrocyListableEntity>(
  entity: E,
): Promise<GrocyEntityTypeMap[E][]> {
  // The `as any` here is required because the generated ExposedEntity_* types
  // are plain `string` aliases and do not accept string literal types.
  const raw = await GenericEntityInteractionsService.getObjects(entity as any);
  return (Array.isArray(raw) ? raw : []) as GrocyEntityTypeMap[E][];
}

/**
 * Create a single object of the given Grocy entity.
 * Returns `{ created_object_id?: number }`.
 */
export async function createGrocyEntity(
  entity: 'products',
  body: CreateProductBody,
): Promise<{ created_object_id?: number }>;
export async function createGrocyEntity(
  entity: 'quantity_units',
  body: CreateQuantityUnitBody,
): Promise<{ created_object_id?: number }>;
export async function createGrocyEntity(
  entity: GrocyEditableEntity,
  body: Record<string, unknown>,
): Promise<{ created_object_id?: number }>;
export async function createGrocyEntity(
  entity: GrocyEditableEntity,
  body: CreateProductBody | CreateQuantityUnitBody | Record<string, unknown>,
): Promise<{ created_object_id?: number }> {
  return GenericEntityInteractionsService.postObjects(entity as any, body as any);
}

/**
 * Update (PUT) a single object of the given Grocy entity.
 */
export async function updateGrocyEntity(
  entity: 'products',
  id: number,
  body: UpdateProductBody,
): Promise<void>;
export async function updateGrocyEntity(
  entity: 'quantity_units',
  id: number,
  body: UpdateQuantityUnitBody,
): Promise<void>;
export async function updateGrocyEntity(
  entity: GrocyEditableEntity,
  id: number,
  body: Record<string, unknown>,
): Promise<void>;
export async function updateGrocyEntity(
  entity: GrocyEditableEntity,
  id: number,
  body: UpdateProductBody | UpdateQuantityUnitBody | Record<string, unknown>,
): Promise<void> {
  return GenericEntityInteractionsService.putObjects(entity as any, id, body as any);
}

/**
 * Delete a single object of the given Grocy entity.
 */
export async function deleteGrocyEntity(
  entity: GrocyDeletableEntity,
  id: number,
): Promise<void> {
  return GenericEntityInteractionsService.deleteObjects(entity as any, id);
}

// ---------------------------------------------------------------------------
// Typed wrappers for StockService
// ---------------------------------------------------------------------------

/** Missing product entry as found in `CurrentVolatilStockResponse.missing_products`. */
export interface GrocyMissingProduct {
  id: number;
  name: string;
  amount_missing: number;
  is_partly_in_stock: number;
}

/** Typed result from StockService.getStockVolatile(). */
export interface GrocyVolatileStock {
  due_products?: CurrentVolatilStockResponse['due_products'];
  overdue_products?: CurrentVolatilStockResponse['overdue_products'];
  expired_products?: CurrentVolatilStockResponse['expired_products'];
  missing_products?: GrocyMissingProduct[];
}

/**
 * Fetch volatile stock data (due, overdue, expired, missing).
 * The generated type has `missing_products: Array<any>` -- this wrapper
 * returns a properly typed version.
 */
export async function getVolatileStock(): Promise<GrocyVolatileStock> {
  const raw = await StockService.getStockVolatile();
  return raw as GrocyVolatileStock;
}

/**
 * Fetch product details for a given Grocy product ID.
 * Returns the properly typed `ProductDetailsResponse`.
 */
export async function getProductDetails(productId: number): Promise<ProductDetailsResponse> {
  return StockService.getStockProducts(productId);
}

/**
 * Add stock for a given product (purchase transaction).
 */
export async function addProductStock(
  productId: number,
  amount: number,
): Promise<void> {
  await StockService.postStockProductsAdd(productId, {
    amount,
    transaction_type: StockTransactionType.PURCHASE,
  });
}

// Re-export model types that are commonly used in application code
export type { Product, QuantityUnit, Location, ShoppingListItem, ProductDetailsResponse };

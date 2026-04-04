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
import type { StockEntry } from './client/models/StockEntry';
import type { Product } from './client/models/Product';
import type { ProductGroup } from './client/models/ProductGroup';
import type { QuantityUnit } from './client/models/QuantityUnit';
import type { QuantityUnitConversion } from './client/models/QuantityUnitConversion';
import type { Location } from './client/models/Location';
import type { ShoppingListItem } from './client/models/ShoppingListItem';
import type { CurrentVolatilStockResponse } from './client/models/CurrentVolatilStockResponse';
import type { CurrentStockResponse } from './client/models/CurrentStockResponse';
import type { ProductDetailsResponse } from './client/models/ProductDetailsResponse';
import { StockTransactionType } from './client/models/StockTransactionType';

// ---------------------------------------------------------------------------
// Entity name unions
// ---------------------------------------------------------------------------

/** Entity names used for listing (getObjects). */
export type GrocyListableEntity =
  | 'products'
  | 'product_groups'
  | 'quantity_units'
  | 'quantity_unit_conversions'
  | 'locations'
  | 'shopping_list';

/** Entity names used for creation/editing (postObjects, putObjects). */
export type GrocyEditableEntity =
  | 'products'
  | 'product_groups'
  | 'quantity_units'
  | 'quantity_unit_conversions'
  | 'locations'
  | 'shopping_list';

/** Entity names used for deletion (deleteObjects). */
export type GrocyDeletableEntity =
  | 'products'
  | 'product_groups'
  | 'quantity_units'
  | 'quantity_unit_conversions'
  | 'locations'
  | 'shopping_list';

// ---------------------------------------------------------------------------
// Entity-to-type mapping
// ---------------------------------------------------------------------------

/** Maps entity name strings to their Grocy model types. */
interface GrocyEntityTypeMap {
  products: Product;
  product_groups: ProductGroup;
  quantity_units: QuantityUnit;
  quantity_unit_conversions: QuantityUnitConversion;
  locations: Location;
  shopping_list: ShoppingListItem;
}

const EDITABLE_ENTITY_FIELDS = {
  products: [
    'name',
    'description',
    'location_id',
    'qu_id_purchase',
    'qu_id_stock',
    'enable_tare_weight_handling',
    'not_check_stock_fulfillment_for_recipes',
    'product_group_id',
    'tare_weight',
    'min_stock_amount',
    'default_best_before_days',
    'default_best_before_days_after_open',
    'default_best_before_days_after_freezing',
    'default_best_before_days_after_thawing',
    'picture_file_name',
    'shopping_location_id',
    'due_type',
    'treat_opened_as_out_of_stock',
    'auto_reprint_stock_label',
    'no_own_stock',
    'should_not_be_frozen',
    'default_consume_location_id',
    'move_on_open',
  ],
  product_groups: [
    'name',
    'description',
  ],
  quantity_units: [
    'name',
    'name_plural',
    'description',
    'plural_forms',
  ],
  quantity_unit_conversions: [
    'from_qu_id',
    'to_qu_id',
    'factor',
    'product_id',
  ],
  locations: [
    'name',
    'description',
  ],
  shopping_list: [
    'shopping_list_id',
    'product_id',
    'note',
    'amount',
  ],
} as const satisfies Record<GrocyEditableEntity, readonly string[]>;

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
  description?: string;
  plural_forms?: string;
}

/** Fields accepted when creating a Grocy location. */
export interface CreateLocationBody {
  name: string;
  description?: string | null;
}

/** Fields accepted when creating a Grocy product group. */
export interface CreateProductGroupBody {
  name: string;
  description?: string | null;
}

/** Fields accepted when creating a Grocy quantity unit conversion. */
export interface CreateQuantityUnitConversionBody {
  from_qu_id: number;
  to_qu_id: number;
  factor: number;
  product_id?: number | null;
}

/** Fields accepted when updating a Grocy product (partial). */
export interface UpdateProductBody {
    name?: string;
    description?: string | null;
    min_stock_amount?: number;
    qu_id_purchase?: number;
    qu_id_stock?: number;
    location_id?: number;
    product_group_id?: number;
    default_best_before_days?: number | null;
    default_best_before_days_after_open?: number | null;
    default_best_before_days_after_freezing?: number | null;
    default_best_before_days_after_thawing?: number | null;
    due_type?: number | null;
    treat_opened_as_out_of_stock?: number;
    should_not_be_frozen?: number;
    move_on_open?: number;
    default_consume_location_id?: number;
}

/** Fields accepted when updating a Grocy quantity unit (partial). */
export interface UpdateQuantityUnitBody {
  name?: string;
  name_plural?: string;
  description?: string | null;
  plural_forms?: string;
}

/** Fields accepted when updating a Grocy location (partial). */
export interface UpdateLocationBody {
  name?: string;
  description?: string | null;
}

/** Fields accepted when updating a Grocy product group (partial). */
export interface UpdateProductGroupBody {
  name?: string;
  description?: string | null;
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
  entity: 'locations',
  body: CreateLocationBody,
): Promise<{ created_object_id?: number }>;
export async function createGrocyEntity(
  entity: 'product_groups',
  body: CreateProductGroupBody,
): Promise<{ created_object_id?: number }>;
export async function createGrocyEntity(
  entity: 'quantity_unit_conversions',
  body: CreateQuantityUnitConversionBody,
): Promise<{ created_object_id?: number }>;
export async function createGrocyEntity(
  entity: GrocyEditableEntity,
  body: Record<string, unknown>,
): Promise<{ created_object_id?: number }>;
export async function createGrocyEntity(
  entity: GrocyEditableEntity,
  body:
    | CreateProductBody
    | CreateQuantityUnitBody
    | CreateLocationBody
    | CreateProductGroupBody
    | CreateQuantityUnitConversionBody
    | Record<string, unknown>,
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
  entity: 'locations',
  id: number,
  body: UpdateLocationBody,
): Promise<void>;
export async function updateGrocyEntity(
  entity: 'product_groups',
  id: number,
  body: UpdateProductGroupBody,
): Promise<void>;
export async function updateGrocyEntity(
  entity: GrocyEditableEntity,
  id: number,
  body: Record<string, unknown>,
): Promise<void>;
export async function updateGrocyEntity(
  entity: GrocyEditableEntity,
  id: number,
  body:
    | UpdateProductBody
    | UpdateQuantityUnitBody
    | UpdateLocationBody
    | UpdateProductGroupBody
    | Record<string, unknown>,
): Promise<void> {
  // Grocy's object PUT endpoint expects a full entity payload rather than a partial patch.
  // Merge the requested changes onto the current entity so callers can safely pass only the
  // fields they want to change.
  const existing = await GenericEntityInteractionsService.getObjects1(entity as any, id);
  const mergedBody = { ...existing, ...body };
  const sanitizedBody = sanitizeGrocyEntityUpdate(entity, mergedBody);
  return GenericEntityInteractionsService.putObjects(entity as any, id, sanitizedBody as any);
}

function sanitizeGrocyEntityUpdate(
  entity: GrocyEditableEntity,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const editableFields = EDITABLE_ENTITY_FIELDS[entity];
  const sanitized: Record<string, unknown> = {};

  for (const field of editableFields) {
    const value = body[field];
    // Preserve explicit nulls so callers can clear nullable Grocy fields such as
    // descriptions and date defaults via the generic entity update wrapper.
    if (value !== undefined) {
      sanitized[field] = value;
    }
  }

  return sanitized;
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
 * Fetch the current stock overview for all products currently in stock.
 */
export async function getCurrentStock(): Promise<CurrentStockResponse[]> {
  return StockService.getStock();
}

/**
 * Fetch product details for a given Grocy product ID.
 * Returns the properly typed `ProductDetailsResponse`.
 */
export async function getProductDetails(productId: number): Promise<ProductDetailsResponse> {
  return StockService.getStockProducts(productId);
}

/**
 * Fetch all stock entries for a given Grocy product ID.
 */
export async function getProductStockEntries(productId: number): Promise<StockEntry[]> {
  return StockService.getStockProductsEntries(productId);
}

/**
 * Fetch all stock entries for a given Grocy location ID.
 */
export async function getLocationStockEntries(locationId: number): Promise<StockEntry[]> {
  return StockService.getStockLocationsEntries(locationId);
}

/**
 * Fetch one stock entry by its Grocy stock entry ID.
 */
export async function getGrocyStockEntry(entryId: number): Promise<StockEntry> {
  return StockService.getStockEntry(entryId);
}

/**
 * Update a Grocy stock entry.
 */
export async function updateGrocyStockEntry(
  entryId: number,
  input: {
    amount?: number;
    bestBeforeDate?: string | null;
    price?: number;
    open?: boolean;
    locationId?: number;
    shoppingLocationId?: number;
    purchasedDate?: string;
  },
): Promise<void> {
  await StockService.putStockEntry(entryId, {
    amount: input.amount,
    best_before_date: input.bestBeforeDate ?? undefined,
    price: input.price,
    open: input.open,
    location_id: input.locationId,
    shopping_location_id: input.shoppingLocationId,
    purchased_date: input.purchasedDate,
  });
}

/**
 * Add stock for a given product (purchase transaction).
 */
export async function addProductStock(
  productId: number,
  amountOrInput: number | {
    amount: number;
    bestBeforeDate?: string | null;
    note?: string | null;
  },
): Promise<void> {
  const input = typeof amountOrInput === 'number'
    ? { amount: amountOrInput }
    : amountOrInput;

  await StockService.postStockProductsAdd(productId, {
    amount: input.amount,
    best_before_date: input.bestBeforeDate ?? undefined,
    note: input.note ?? undefined,
    transaction_type: StockTransactionType.PURCHASE,
  });
}

/**
 * Remove stock for a given product.
 */
export async function consumeProductStock(
  productId: number,
  input: {
    amount: number;
    spoiled?: boolean;
    exactAmount?: boolean;
  },
): Promise<void> {
  await StockService.postStockProductsConsume(productId, {
    amount: input.amount,
    spoiled: input.spoiled ?? false,
    exact_amount: input.exactAmount ?? false,
    transaction_type: StockTransactionType.CONSUME,
  });
}

/**
 * Correct stock for a given product to the provided exact amount.
 */
export async function inventoryProductStock(
  productId: number,
  input: {
    newAmount: number;
    bestBeforeDate?: string | null;
    note?: string | null;
  },
): Promise<void> {
  await StockService.postStockProductsInventory(productId, {
    new_amount: input.newAmount,
    best_before_date: input.bestBeforeDate ?? undefined,
    note: input.note ?? undefined,
  });
}

/**
 * Mark stock as opened for a given product.
 */
export async function openProductStock(
  productId: number,
  input: {
    amount: number;
  },
): Promise<void> {
  await StockService.postStockProductsOpen(productId, {
    amount: input.amount,
  });
}

// Re-export model types that are commonly used in application code
export type { Product, ProductGroup, QuantityUnit, QuantityUnitConversion, Location, ShoppingListItem, StockEntry, ProductDetailsResponse, CurrentStockResponse };

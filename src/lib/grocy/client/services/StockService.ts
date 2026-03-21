/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CurrentStockResponse } from '../models/CurrentStockResponse';
import type { CurrentVolatilStockResponse } from '../models/CurrentVolatilStockResponse';
import type { ExternalBarcodeLookupResponse } from '../models/ExternalBarcodeLookupResponse';
import type { ProductDetailsResponse } from '../models/ProductDetailsResponse';
import type { ProductPriceHistory } from '../models/ProductPriceHistory';
import type { StockEntry } from '../models/StockEntry';
import type { StockLocation } from '../models/StockLocation';
import type { StockLogEntry } from '../models/StockLogEntry';
import type { StockTransactionType } from '../models/StockTransactionType';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class StockService {
    /**
     * Returns all products which are currently in stock incl. the next due date per product
     * @returns CurrentStockResponse An array of CurrentStockResponse objects
     * @throws ApiError
     */
    public static getStock(): CancelablePromise<Array<CurrentStockResponse>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/stock',
        });
    }
    /**
     * Returns details of the given stock
     * @param entryId A valid stock entry id
     * @returns StockEntry A StockEntry Response object
     * @throws ApiError
     */
    public static getStockEntry(
        entryId: number,
    ): CancelablePromise<StockEntry> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/stock/entry/{entryId}',
            path: {
                'entryId': entryId,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Not existing product)`,
            },
        });
    }
    /**
     * Edits the stock entry
     * @param entryId A valid stock entry id
     * @param requestBody
     * @returns StockLogEntry The operation was successful
     * @throws ApiError
     */
    public static putStockEntry(
        entryId: number,
        requestBody: {
            /**
             * The amount to add - please note that when tare weight handling for the product is enabled, this needs to be the amount including the container weight (gross), the amount to be posted will be automatically calculated based on what is in stock and the defined tare weight
             */
            amount?: number;
            /**
             * The due date of the product to add, when omitted, the current date is used
             */
            best_before_date?: string;
            /**
             * The price per stock quantity unit in configured currency
             */
            price?: number;
            /**
             * If the stock entry was already opened or not
             */
            open?: boolean;
            /**
             * If omitted, the default location of the product is used
             */
            location_id?: number;
            /**
             * If omitted, no store will be affected
             */
            shopping_location_id?: number;
            /**
             * The date when this stock entry was purchased
             */
            purchased_date?: string;
        },
    ): CancelablePromise<Array<StockLogEntry>> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/stock/entry/{entryId}',
            path: {
                'entryId': entryId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful (possible errors are: Not existing product, invalid transaction type)`,
            },
        });
    }
    /**
     * Prints the Grocycode / stock entry label of the given entry on the configured label printer
     * @param entryId A valid stock entry id
     * @returns any The operation was successful
     * @throws ApiError
     */
    public static getStockEntryPrintlabel(
        entryId: number,
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/stock/entry/{entryId}/printlabel',
            path: {
                'entryId': entryId,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Not existing stock entry, error on WebHook execution)`,
            },
        });
    }
    /**
     * Returns all products which are due soon, overdue, expired or currently missing
     * @param dueSoonDays The number of days in which products are considered to be due soon
     * @returns CurrentVolatilStockResponse A CurrentVolatilStockResponse object
     * @throws ApiError
     */
    public static getStockVolatile(
        dueSoonDays: number = 5,
    ): CancelablePromise<CurrentVolatilStockResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/stock/volatile',
            query: {
                'due_soon_days': dueSoonDays,
            },
        });
    }
    /**
     * Returns details of the given product
     * @param productId A valid product id
     * @returns ProductDetailsResponse A ProductDetailsResponse object
     * @throws ApiError
     */
    public static getStockProducts(
        productId: number,
    ): CancelablePromise<ProductDetailsResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/stock/products/{productId}',
            path: {
                'productId': productId,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Not existing product)`,
            },
        });
    }
    /**
     * Returns all locations where the given product currently has stock
     * @param productId A valid product id
     * @param includeSubProducts If sub product locations should be included (if the given product is a parent product and in addition to the ones of the given product)
     * @param queryArray An array of filter conditions, each of them is a string in the form of `<field><condition><value>` where<br>`<field>` is a valid field name<br>`<condition>` is a comparison operator, one of<br>&nbsp;&nbsp;`=` equal<br>&nbsp;&nbsp;`!=` not equal<br>&nbsp;&nbsp;`~` LIKE<br>&nbsp;&nbsp;`!~` not LIKE<br>&nbsp;&nbsp;`<` less<br>&nbsp;&nbsp;`>` greater<br>&nbsp;&nbsp;`<=` less or equal<br>&nbsp;&nbsp;`>=` greater or equal<br>&nbsp;&nbsp;`§` regular expression<br>`<value>` is the value to search for
     * @param order A valid field name by which the response should be ordered, use the separator `:` to specify the sort order (`asc` or `desc`, defaults to `asc` when omitted)
     * @param limit The maximum number of objects to return
     * @param offset The number of objects to skip
     * @returns StockLocation An array of StockLocation objects
     * @throws ApiError
     */
    public static getStockProductsLocations(
        productId: number,
        includeSubProducts?: boolean,
        queryArray?: Array<string>,
        order?: string,
        limit?: number,
        offset?: number,
    ): CancelablePromise<Array<StockLocation>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/stock/products/{productId}/locations',
            path: {
                'productId': productId,
            },
            query: {
                'include_sub_products': includeSubProducts,
                'query[]': queryArray,
                'order': order,
                'limit': limit,
                'offset': offset,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Not existing product)`,
                500: `The operation was not successful (possible errors are invalid field names or conditions in filter parameters provided)`,
            },
        });
    }
    /**
     * Returns all stock entries of the given product in order of next use (Opened first, then first due first, then first in first out)
     * @param productId A valid product id
     * @param includeSubProducts If sub products should be included (if the given product is a parent product and in addition to the ones of the given product)
     * @param queryArray An array of filter conditions, each of them is a string in the form of `<field><condition><value>` where<br>`<field>` is a valid field name<br>`<condition>` is a comparison operator, one of<br>&nbsp;&nbsp;`=` equal<br>&nbsp;&nbsp;`!=` not equal<br>&nbsp;&nbsp;`~` LIKE<br>&nbsp;&nbsp;`!~` not LIKE<br>&nbsp;&nbsp;`<` less<br>&nbsp;&nbsp;`>` greater<br>&nbsp;&nbsp;`<=` less or equal<br>&nbsp;&nbsp;`>=` greater or equal<br>&nbsp;&nbsp;`§` regular expression<br>`<value>` is the value to search for
     * @param order A valid field name by which the response should be ordered, use the separator `:` to specify the sort order (`asc` or `desc`, defaults to `asc` when omitted)
     * @param limit The maximum number of objects to return
     * @param offset The number of objects to skip
     * @returns StockEntry An array of StockEntry objects
     * @throws ApiError
     */
    public static getStockProductsEntries(
        productId: number,
        includeSubProducts?: boolean,
        queryArray?: Array<string>,
        order?: string,
        limit?: number,
        offset?: number,
    ): CancelablePromise<Array<StockEntry>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/stock/products/{productId}/entries',
            path: {
                'productId': productId,
            },
            query: {
                'include_sub_products': includeSubProducts,
                'query[]': queryArray,
                'order': order,
                'limit': limit,
                'offset': offset,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Not existing product)`,
                500: `The operation was not successful (possible errors are invalid field names or conditions in filter parameters provided)`,
            },
        });
    }
    /**
     * Returns the price history of the given product
     * @param productId A valid product id
     * @returns ProductPriceHistory An array of ProductPriceHistory objects
     * @throws ApiError
     */
    public static getStockProductsPriceHistory(
        productId: number,
    ): CancelablePromise<Array<ProductPriceHistory>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/stock/products/{productId}/price-history',
            path: {
                'productId': productId,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Not existing product)`,
            },
        });
    }
    /**
     * Adds the given amount of the given product to stock
     * @param productId A valid product id
     * @param requestBody
     * @returns StockLogEntry The operation was successful
     * @throws ApiError
     */
    public static postStockProductsAdd(
        productId: number,
        requestBody: {
            /**
             * The amount to add - please note that when tare weight handling for the product is enabled, this needs to be the amount including the container weight (gross), the amount to be posted will be automatically calculated based on what is in stock and the defined tare weight
             */
            amount?: number;
            /**
             * The due date of the product to add, when omitted, the current date is used
             */
            best_before_date?: string;
            transaction_type?: StockTransactionType;
            /**
             * The price per stock quantity unit in configured currency
             */
            price?: number;
            /**
             * If omitted, the default location of the product is used
             */
            location_id?: number;
            /**
             * If omitted, no store will be affected
             */
            shopping_location_id?: number;
            /**
             * `1` = No label, `2` = Single label, `3` = Label per unit
             */
            stock_label_type?: number;
            /**
             * An optional note for the corresponding stock entry
             */
            note?: string;
        },
    ): CancelablePromise<Array<StockLogEntry>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/stock/products/{productId}/add',
            path: {
                'productId': productId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful (possible errors are: Not existing product, invalid transaction type)`,
            },
        });
    }
    /**
     * Removes the given amount of the given product from stock
     * @param productId A valid product id
     * @param requestBody
     * @returns StockLogEntry The operation was successful
     * @throws ApiError
     */
    public static postStockProductsConsume(
        productId: number,
        requestBody: {
            /**
             * The amount to remove - please note that when tare weight handling for the product is enabled, this needs to be the amount including the container weight (gross), the amount to be posted will be automatically calculated based on what is in stock and the defined tare weight
             */
            amount?: number;
            transaction_type?: StockTransactionType;
            /**
             * True when the given product was spoiled, defaults to false
             */
            spoiled?: boolean;
            /**
             * A specific stock entry id to consume, if used, the amount has to be 1
             */
            stock_entry_id?: string;
            /**
             * A valid recipe id for which this product was used (for statistical purposes only)
             */
            recipe_id?: number;
            /**
             * A valid location id (if supplied, only stock at the given location is considered, if ommitted, stock of any location is considered)
             */
            location_id?: number;
            /**
             * For tare weight handling enabled products, `true` when the given is the absolute amount to be consumed, not the amount including the container weight
             */
            exact_amount?: boolean;
            /**
             * `true` when any in stock sub product should be used when the given product is a parent product and currently not in stock
             */
            allow_subproduct_substitution?: boolean;
        },
    ): CancelablePromise<Array<StockLogEntry>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/stock/products/{productId}/consume',
            path: {
                'productId': productId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful (possible errors are: Not existing product, invalid transaction type, given amount > current stock amount)`,
            },
        });
    }
    /**
     * Transfers the given amount of the given product from one location to another (this is currently not supported for tare weight handling enabled products)
     * @param productId A valid product id
     * @param requestBody
     * @returns StockLogEntry The operation was successful
     * @throws ApiError
     */
    public static postStockProductsTransfer(
        productId: number,
        requestBody: {
            /**
             * The amount to transfer - please note that when tare weight handling for the product is enabled, this needs to be the amount including the container weight (gross), the amount to be posted will be automatically calculated based on what is in stock and the defined tare weight
             */
            amount?: number;
            /**
             * A valid location id, the location from where the product should be transfered
             */
            location_id_from?: number;
            /**
             * A valid location id, the location to where the product should be transfered
             */
            location_id_to?: number;
            /**
             * A specific stock entry id to transfer, if used, the amount has to be 1
             */
            stock_entry_id?: string;
        },
    ): CancelablePromise<Array<StockLogEntry>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/stock/products/{productId}/transfer',
            path: {
                'productId': productId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful (possible errors are: Not existing product, no existing from or to location, given amount > current stock amount at the source location)`,
            },
        });
    }
    /**
     * Inventories the given product (adds/removes based on the given new amount)
     * @param productId A valid product id
     * @param requestBody
     * @returns StockLogEntry The operation was successful
     * @throws ApiError
     */
    public static postStockProductsInventory(
        productId: number,
        requestBody: {
            /**
             * The new current amount for the given product - please note that when tare weight handling for the product is enabled, this needs to be the amount including the container weight (gross), the amount to be posted will be automatically calculated based on what is in stock and the defined tare weight
             */
            new_amount?: number;
            /**
             * The due date which applies to added products
             */
            best_before_date?: string;
            /**
             * If omitted, no store will be affected
             */
            shopping_location_id?: number;
            /**
             * If omitted, the default location of the product is used (only applies to added products)
             */
            location_id?: number;
            /**
             * If omitted, the last price of the product is used (only applies to added products)
             */
            price?: number;
            /**
             * `1` = No label, `2` = Single label, `3` = Label per unit (only applies to added products)
             */
            stock_label_type?: number;
            /**
             * An optional note for the corresponding stock entry (only applies to added products)
             */
            note?: string;
        },
    ): CancelablePromise<Array<StockLogEntry>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/stock/products/{productId}/inventory',
            path: {
                'productId': productId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful (possible errors are: Not existing product)`,
            },
        });
    }
    /**
     * Marks the given amount of the given product as opened
     * @param productId A valid product id
     * @param requestBody
     * @returns StockLogEntry The operation was successful
     * @throws ApiError
     */
    public static postStockProductsOpen(
        productId: number,
        requestBody: {
            /**
             * The amount to mark as opened
             */
            amount?: number;
            /**
             * A specific stock entry id to open, if used, the amount has to be 1
             */
            stock_entry_id?: string;
            /**
             * `true` when any in stock sub product should be used when the given product is a parent product and currently not in stock
             */
            allow_subproduct_substitution?: boolean;
        },
    ): CancelablePromise<Array<StockLogEntry>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/stock/products/{productId}/open',
            path: {
                'productId': productId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful (possible errors are: Not existing product, given amount > current unopened stock amount)`,
            },
        });
    }
    /**
     * Prints the Grocycode label of the given product on the configured label printer
     * @param productId A valid product id
     * @returns any The operation was successful
     * @throws ApiError
     */
    public static getStockProductsPrintlabel(
        productId: number,
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/stock/products/{productId}/printlabel',
            path: {
                'productId': productId,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Not existing product, error on WebHook execution)`,
            },
        });
    }
    /**
     * Merges two products into one
     * @param productIdToKeep A valid product id of the product to keep
     * @param productIdToRemove A valid product id of the product to remove
     * @returns void
     * @throws ApiError
     */
    public static postStockProductsMerge(
        productIdToKeep: number,
        productIdToRemove: number,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/stock/products/{productIdToKeep}/merge/{productIdToRemove}',
            path: {
                'productIdToKeep': productIdToKeep,
                'productIdToRemove': productIdToRemove,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Invalid product id)`,
            },
        });
    }
    /**
     * Returns all stock entries of the given location
     * @param locationId A valid location id
     * @param queryArray An array of filter conditions, each of them is a string in the form of `<field><condition><value>` where<br>`<field>` is a valid field name<br>`<condition>` is a comparison operator, one of<br>&nbsp;&nbsp;`=` equal<br>&nbsp;&nbsp;`!=` not equal<br>&nbsp;&nbsp;`~` LIKE<br>&nbsp;&nbsp;`!~` not LIKE<br>&nbsp;&nbsp;`<` less<br>&nbsp;&nbsp;`>` greater<br>&nbsp;&nbsp;`<=` less or equal<br>&nbsp;&nbsp;`>=` greater or equal<br>&nbsp;&nbsp;`§` regular expression<br>`<value>` is the value to search for
     * @param order A valid field name by which the response should be ordered, use the separator `:` to specify the sort order (`asc` or `desc`, defaults to `asc` when omitted)
     * @param limit The maximum number of objects to return
     * @param offset The number of objects to skip
     * @returns StockEntry An array of StockEntry objects
     * @throws ApiError
     */
    public static getStockLocationsEntries(
        locationId: number,
        queryArray?: Array<string>,
        order?: string,
        limit?: number,
        offset?: number,
    ): CancelablePromise<Array<StockEntry>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/stock/locations/{locationId}/entries',
            path: {
                'locationId': locationId,
            },
            query: {
                'query[]': queryArray,
                'order': order,
                'limit': limit,
                'offset': offset,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Not existing location)`,
                500: `The operation was not successful (possible errors are invalid field names or conditions in filter parameters provided)`,
            },
        });
    }
    /**
     * Adds currently missing products (below defined min. stock amount) to the given shopping list
     * @param requestBody
     * @returns void
     * @throws ApiError
     */
    public static postStockShoppinglistAddMissingProducts(
        requestBody?: {
            /**
             * The shopping list to use, when omitted, the default shopping list (with id 1) is used
             */
            list_id?: number;
        },
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/stock/shoppinglist/add-missing-products',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful (possible errors are: Not existing shopping list)`,
            },
        });
    }
    /**
     * Adds overdue products to the given shopping list
     * @param requestBody
     * @returns void
     * @throws ApiError
     */
    public static postStockShoppinglistAddOverdueProducts(
        requestBody?: {
            /**
             * The shopping list to use, when omitted, the default shopping list (with id 1) is used
             */
            list_id?: number;
        },
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/stock/shoppinglist/add-overdue-products',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful (possible errors are: Not existing shopping list)`,
            },
        });
    }
    /**
     * Adds expired products to the given shopping list
     * @param requestBody
     * @returns void
     * @throws ApiError
     */
    public static postStockShoppinglistAddExpiredProducts(
        requestBody?: {
            /**
             * The shopping list to use, when omitted, the default shopping list (with id 1) is used
             */
            list_id?: number;
        },
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/stock/shoppinglist/add-expired-products',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful (possible errors are: Not existing shopping list)`,
            },
        });
    }
    /**
     * Removes all items from the given shopping list
     * @param requestBody
     * @returns void
     * @throws ApiError
     */
    public static postStockShoppinglistClear(
        requestBody?: {
            /**
             * The shopping list id to clear, when omitted, the default shopping list (with id 1) is used
             */
            list_id?: number;
            /**
             * When `true`, only done items will be removed (defaults to `false` when ommited)
             */
            done_only?: boolean;
        },
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/stock/shoppinglist/clear',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful (possible errors are: Not existing shopping list)`,
            },
        });
    }
    /**
     * Adds the given amount of the given product to the given shopping list
     * If the product is already on the shopping list, the given amount will increase the amount of the already existing item, otherwise a new item will be added
     * @param requestBody
     * @returns void
     * @throws ApiError
     */
    public static postStockShoppinglistAddProduct(
        requestBody: {
            /**
             * A valid product id of the product to be added
             */
            product_id?: number;
            /**
             * A valid quantity unit id (used only for display; the amount needs to be related to the products stock QU), when omitted, the products stock QU is used
             */
            qu_id?: number;
            /**
             * A valid shopping list id, when omitted, the default shopping list (with id 1) is used
             */
            list_id?: number;
            /**
             * The amount (related to the products stock QU) to add, when omitted, the default amount of 1 is used
             */
            product_amount?: number;
            /**
             * The note of the shopping list item
             */
            note?: string;
        },
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/stock/shoppinglist/add-product',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful (possible errors are: Not existing shopping list, Invalid product id supplied)`,
            },
        });
    }
    /**
     * Removes the given amount of the given product from the given shopping list, if it is on it
     * If the resulting amount is <= 0, the item will be completely removed from the given list, otherwise the given amount will reduce the amount of the existing item
     * @param requestBody
     * @returns void
     * @throws ApiError
     */
    public static postStockShoppinglistRemoveProduct(
        requestBody: {
            /**
             * A valid product id of the item on the shopping list
             */
            product_id?: number;
            /**
             * A valid shopping list id, when omitted, the default shopping list (with id 1) is used
             */
            list_id?: number;
            /**
             * The amount of product units to remove, when omitted, the default amount of 1 is used
             */
            product_amount?: number;
        },
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/stock/shoppinglist/remove-product',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful (possible errors are: Not existing shopping list, Invalid product id supplied)`,
            },
        });
    }
    /**
     * Returns the given stock booking
     * @param bookingId A valid stock booking id
     * @returns StockLogEntry A StockLogEntry object
     * @throws ApiError
     */
    public static getStockBookings(
        bookingId: number,
    ): CancelablePromise<StockLogEntry> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/stock/bookings/{bookingId}',
            path: {
                'bookingId': bookingId,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Invalid stock booking id)`,
            },
        });
    }
    /**
     * Undoes a booking
     * @param bookingId A valid stock booking id
     * @returns void
     * @throws ApiError
     */
    public static postStockBookingsUndo(
        bookingId: number,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/stock/bookings/{bookingId}/undo',
            path: {
                'bookingId': bookingId,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Not existing booking)`,
            },
        });
    }
    /**
     * Returns all stock bookings of the given transaction id
     * @param transactionId A valid stock transaction id
     * @returns StockLogEntry An array of StockLogEntry objects
     * @throws ApiError
     */
    public static getStockTransactions(
        transactionId: string,
    ): CancelablePromise<Array<StockLogEntry>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/stock/transactions/{transactionId}',
            path: {
                'transactionId': transactionId,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Not existing transaction)`,
            },
        });
    }
    /**
     * Undoes a transaction
     * @param transactionId A valid stock transaction id
     * @returns void
     * @throws ApiError
     */
    public static postStockTransactionsUndo(
        transactionId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/stock/transactions/{transactionId}/undo',
            path: {
                'transactionId': transactionId,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Not existing transaction)`,
            },
        });
    }
    /**
     * Executes an external barcode lookoup via the configured plugin with the given barcode
     * @param barcode The barcode to lookup up
     * @param add When true, the product is added to the database on a successful lookup and the new product id is in included in the response
     * @returns ExternalBarcodeLookupResponse An ExternalBarcodeLookupResponse object or null, when nothing was found for the given barcode
     * @throws ApiError
     */
    public static getStockBarcodesExternalLookup(
        barcode: string,
        add: boolean = false,
    ): CancelablePromise<ExternalBarcodeLookupResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/stock/barcodes/external-lookup/{barcode}',
            path: {
                'barcode': barcode,
            },
            query: {
                'add': add,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Plugin error)`,
            },
        });
    }
}

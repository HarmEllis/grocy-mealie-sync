/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ProductDetailsResponse } from '../models/ProductDetailsResponse';
import type { StockLogEntry } from '../models/StockLogEntry';
import type { StockTransactionType } from '../models/StockTransactionType';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class StockByBarcodeService {
    /**
     * Returns details of the given product by its barcode
     * @param barcode Barcode
     * @returns ProductDetailsResponse A ProductDetailsResponse object
     * @throws ApiError
     */
    public static getStockProductsByBarcode(
        barcode: string,
    ): CancelablePromise<ProductDetailsResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/stock/products/by-barcode/{barcode}',
            path: {
                'barcode': barcode,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Unknown barcode)`,
            },
        });
    }
    /**
     * Adds the given amount of the by its barcode given product to stock
     * @param barcode Barcode
     * @param requestBody
     * @returns StockLogEntry The operation was successful
     * @throws ApiError
     */
    public static postStockProductsByBarcodeAdd(
        barcode: string,
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
        },
    ): CancelablePromise<Array<StockLogEntry>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/stock/products/by-barcode/{barcode}/add',
            path: {
                'barcode': barcode,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful (possible errors are: Not existing product, invalid transaction type)`,
            },
        });
    }
    /**
     * Removes the given amount of the by its barcode given product from stock
     * @param barcode Barcode
     * @param requestBody
     * @returns StockLogEntry The operation was successful
     * @throws ApiError
     */
    public static postStockProductsByBarcodeConsume(
        barcode: string,
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
             * `rue` when any in stock sub product should be used when the given product is a parent product and currently not in stock
             */
            allow_subproduct_substitution?: boolean;
        },
    ): CancelablePromise<Array<StockLogEntry>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/stock/products/by-barcode/{barcode}/consume',
            path: {
                'barcode': barcode,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful (possible errors are: Not existing product, invalid transaction type, given amount > current stock amount)`,
            },
        });
    }
    /**
     * Transfers the given amount of the by its barcode given product from one location to another (this is currently not supported for tare weight handling enabled products)
     * @param barcode Barcode
     * @param requestBody
     * @returns StockLogEntry The operation was successful
     * @throws ApiError
     */
    public static postStockProductsByBarcodeTransfer(
        barcode: string,
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
            url: '/stock/products/by-barcode/{barcode}/transfer',
            path: {
                'barcode': barcode,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful (possible errors are: Not existing product, no existing from or to location, given amount > current stock amount at the source location)`,
            },
        });
    }
    /**
     * Inventories the by its barcode given product (adds/removes based on the given new amount)
     * @param barcode Barcode
     * @param requestBody
     * @returns StockLogEntry The operation was successful
     * @throws ApiError
     */
    public static postStockProductsByBarcodeInventory(
        barcode: string,
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
             * If omitted, the default location of the product is used (only applies to added products)
             */
            location_id?: number;
            /**
             * If omitted, the last price of the product is used (only applies to added products)
             */
            price?: number;
        },
    ): CancelablePromise<Array<StockLogEntry>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/stock/products/by-barcode/{barcode}/inventory',
            path: {
                'barcode': barcode,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful (possible errors are: Not existing product)`,
            },
        });
    }
    /**
     * Marks the given amount of the by its barcode given product as opened
     * @param barcode Barcode
     * @param requestBody
     * @returns StockLogEntry The operation was successful
     * @throws ApiError
     */
    public static postStockProductsByBarcodeOpen(
        barcode: string,
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
             * `rue` when any in stock sub product should be used when the given product is a parent product and currently not in stock
             */
            allow_subproduct_substitution?: boolean;
        },
    ): CancelablePromise<Array<StockLogEntry>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/stock/products/by-barcode/{barcode}/open',
            path: {
                'barcode': barcode,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful (possible errors are: Not existing product, given amount > current unopened stock amount)`,
            },
        });
    }
}

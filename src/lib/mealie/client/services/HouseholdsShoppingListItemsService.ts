/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { ShoppingListItemCreate } from '../models/ShoppingListItemCreate';
import type { ShoppingListItemOut_Output } from '../models/ShoppingListItemOut_Output';
import type { ShoppingListItemPagination } from '../models/ShoppingListItemPagination';
import type { ShoppingListItemsCollectionOut } from '../models/ShoppingListItemsCollectionOut';
import type { ShoppingListItemUpdate } from '../models/ShoppingListItemUpdate';
import type { ShoppingListItemUpdateBulk } from '../models/ShoppingListItemUpdateBulk';
import type { SuccessResponse } from '../models/SuccessResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class HouseholdsShoppingListItemsService {
    /**
     * Get All
     * @param orderBy
     * @param orderByNullPosition
     * @param orderDirection
     * @param queryFilter
     * @param paginationSeed
     * @param page
     * @param perPage
     * @param acceptLanguage
     * @returns ShoppingListItemPagination Successful Response
     * @throws ApiError
     */
    public static getAllApiHouseholdsShoppingItemsGet(
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ShoppingListItemPagination> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/shopping/items',
            headers: {
                'accept-language': acceptLanguage,
            },
            query: {
                'orderBy': orderBy,
                'orderByNullPosition': orderByNullPosition,
                'orderDirection': orderDirection,
                'queryFilter': queryFilter,
                'paginationSeed': paginationSeed,
                'page': page,
                'perPage': perPage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create One
     * @param requestBody
     * @param acceptLanguage
     * @returns ShoppingListItemsCollectionOut Successful Response
     * @throws ApiError
     */
    public static createOneApiHouseholdsShoppingItemsPost(
        requestBody: ShoppingListItemCreate,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ShoppingListItemsCollectionOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/shopping/items',
            headers: {
                'accept-language': acceptLanguage,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Many
     * @param requestBody
     * @param acceptLanguage
     * @returns ShoppingListItemsCollectionOut Successful Response
     * @throws ApiError
     */
    public static updateManyApiHouseholdsShoppingItemsPut(
        requestBody: Array<ShoppingListItemUpdateBulk>,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ShoppingListItemsCollectionOut> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/households/shopping/items',
            headers: {
                'accept-language': acceptLanguage,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete Many
     * @param ids
     * @param acceptLanguage
     * @returns SuccessResponse Successful Response
     * @throws ApiError
     */
    public static deleteManyApiHouseholdsShoppingItemsDelete(
        ids?: Array<string>,
        acceptLanguage?: (string | null),
    ): CancelablePromise<SuccessResponse> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/households/shopping/items',
            headers: {
                'accept-language': acceptLanguage,
            },
            query: {
                'ids': ids,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create Many
     * @param requestBody
     * @param acceptLanguage
     * @returns ShoppingListItemsCollectionOut Successful Response
     * @throws ApiError
     */
    public static createManyApiHouseholdsShoppingItemsCreateBulkPost(
        requestBody: Array<ShoppingListItemCreate>,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ShoppingListItemsCollectionOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/shopping/items/create-bulk',
            headers: {
                'accept-language': acceptLanguage,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get One
     * @param itemId
     * @param acceptLanguage
     * @returns ShoppingListItemOut_Output Successful Response
     * @throws ApiError
     */
    public static getOneApiHouseholdsShoppingItemsItemIdGet(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ShoppingListItemOut_Output> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/shopping/items/{item_id}',
            path: {
                'item_id': itemId,
            },
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update One
     * @param itemId
     * @param requestBody
     * @param acceptLanguage
     * @returns ShoppingListItemsCollectionOut Successful Response
     * @throws ApiError
     */
    public static updateOneApiHouseholdsShoppingItemsItemIdPut(
        itemId: string,
        requestBody: ShoppingListItemUpdate,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ShoppingListItemsCollectionOut> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/households/shopping/items/{item_id}',
            path: {
                'item_id': itemId,
            },
            headers: {
                'accept-language': acceptLanguage,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete One
     * @param itemId
     * @param acceptLanguage
     * @returns SuccessResponse Successful Response
     * @throws ApiError
     */
    public static deleteOneApiHouseholdsShoppingItemsItemIdDelete(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<SuccessResponse> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/households/shopping/items/{item_id}',
            path: {
                'item_id': itemId,
            },
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}

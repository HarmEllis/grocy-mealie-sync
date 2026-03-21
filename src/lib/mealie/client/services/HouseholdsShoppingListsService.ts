/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { ShoppingListAddRecipeParams } from '../models/ShoppingListAddRecipeParams';
import type { ShoppingListAddRecipeParamsBulk } from '../models/ShoppingListAddRecipeParamsBulk';
import type { ShoppingListCreate } from '../models/ShoppingListCreate';
import type { ShoppingListMultiPurposeLabelUpdate } from '../models/ShoppingListMultiPurposeLabelUpdate';
import type { ShoppingListOut } from '../models/ShoppingListOut';
import type { ShoppingListPagination } from '../models/ShoppingListPagination';
import type { ShoppingListRemoveRecipeParams } from '../models/ShoppingListRemoveRecipeParams';
import type { ShoppingListUpdate } from '../models/ShoppingListUpdate';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class HouseholdsShoppingListsService {
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
     * @returns ShoppingListPagination Successful Response
     * @throws ApiError
     */
    public static getAllApiHouseholdsShoppingListsGet(
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ShoppingListPagination> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/shopping/lists',
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
     * @returns ShoppingListOut Successful Response
     * @throws ApiError
     */
    public static createOneApiHouseholdsShoppingListsPost(
        requestBody: ShoppingListCreate,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ShoppingListOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/shopping/lists',
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
     * @returns ShoppingListOut Successful Response
     * @throws ApiError
     */
    public static getOneApiHouseholdsShoppingListsItemIdGet(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ShoppingListOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/shopping/lists/{item_id}',
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
     * @returns ShoppingListOut Successful Response
     * @throws ApiError
     */
    public static updateOneApiHouseholdsShoppingListsItemIdPut(
        itemId: string,
        requestBody: ShoppingListUpdate,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ShoppingListOut> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/households/shopping/lists/{item_id}',
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
     * @returns ShoppingListOut Successful Response
     * @throws ApiError
     */
    public static deleteOneApiHouseholdsShoppingListsItemIdDelete(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ShoppingListOut> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/households/shopping/lists/{item_id}',
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
     * Update Label Settings
     * @param itemId
     * @param requestBody
     * @param acceptLanguage
     * @returns ShoppingListOut Successful Response
     * @throws ApiError
     */
    public static updateLabelSettingsApiHouseholdsShoppingListsItemIdLabelSettingsPut(
        itemId: string,
        requestBody: Array<ShoppingListMultiPurposeLabelUpdate>,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ShoppingListOut> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/households/shopping/lists/{item_id}/label-settings',
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
     * Add Recipe Ingredients To List
     * @param itemId
     * @param requestBody
     * @param acceptLanguage
     * @returns ShoppingListOut Successful Response
     * @throws ApiError
     */
    public static addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost(
        itemId: string,
        requestBody: Array<ShoppingListAddRecipeParamsBulk>,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ShoppingListOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/shopping/lists/{item_id}/recipe',
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
     * @deprecated
     * Add Single Recipe Ingredients To List
     * @param itemId
     * @param recipeId
     * @param acceptLanguage
     * @param requestBody
     * @returns ShoppingListOut Successful Response
     * @throws ApiError
     */
    public static addSingleRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipeRecipeIdPost(
        itemId: string,
        recipeId: string,
        acceptLanguage?: (string | null),
        requestBody?: (ShoppingListAddRecipeParams | null),
    ): CancelablePromise<ShoppingListOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/shopping/lists/{item_id}/recipe/{recipe_id}',
            path: {
                'item_id': itemId,
                'recipe_id': recipeId,
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
     * Remove Recipe Ingredients From List
     * @param itemId
     * @param recipeId
     * @param acceptLanguage
     * @param requestBody
     * @returns ShoppingListOut Successful Response
     * @throws ApiError
     */
    public static removeRecipeIngredientsFromListApiHouseholdsShoppingListsItemIdRecipeRecipeIdDeletePost(
        itemId: string,
        recipeId: string,
        acceptLanguage?: (string | null),
        requestBody?: (ShoppingListRemoveRecipeParams | null),
    ): CancelablePromise<ShoppingListOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/shopping/lists/{item_id}/recipe/{recipe_id}/delete',
            path: {
                'item_id': itemId,
                'recipe_id': recipeId,
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
}

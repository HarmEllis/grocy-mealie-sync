/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Body_trigger_action_api_households_recipe_actions__item_id__trigger__recipe_slug__post } from '../models/Body_trigger_action_api_households_recipe_actions__item_id__trigger__recipe_slug__post';
import type { CreateGroupRecipeAction } from '../models/CreateGroupRecipeAction';
import type { GroupRecipeActionOut } from '../models/GroupRecipeActionOut';
import type { GroupRecipeActionPagination } from '../models/GroupRecipeActionPagination';
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { SaveGroupRecipeAction } from '../models/SaveGroupRecipeAction';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class HouseholdsRecipeActionsService {
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
     * @returns GroupRecipeActionPagination Successful Response
     * @throws ApiError
     */
    public static getAllApiHouseholdsRecipeActionsGet(
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<GroupRecipeActionPagination> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/recipe-actions',
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
     * @returns GroupRecipeActionOut Successful Response
     * @throws ApiError
     */
    public static createOneApiHouseholdsRecipeActionsPost(
        requestBody: CreateGroupRecipeAction,
        acceptLanguage?: (string | null),
    ): CancelablePromise<GroupRecipeActionOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/recipe-actions',
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
     * @returns GroupRecipeActionOut Successful Response
     * @throws ApiError
     */
    public static getOneApiHouseholdsRecipeActionsItemIdGet(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<GroupRecipeActionOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/recipe-actions/{item_id}',
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
     * @returns GroupRecipeActionOut Successful Response
     * @throws ApiError
     */
    public static updateOneApiHouseholdsRecipeActionsItemIdPut(
        itemId: string,
        requestBody: SaveGroupRecipeAction,
        acceptLanguage?: (string | null),
    ): CancelablePromise<GroupRecipeActionOut> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/households/recipe-actions/{item_id}',
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
     * @returns GroupRecipeActionOut Successful Response
     * @throws ApiError
     */
    public static deleteOneApiHouseholdsRecipeActionsItemIdDelete(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<GroupRecipeActionOut> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/households/recipe-actions/{item_id}',
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
     * Trigger Action
     * @param itemId
     * @param recipeSlug
     * @param acceptLanguage
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static triggerActionApiHouseholdsRecipeActionsItemIdTriggerRecipeSlugPost(
        itemId: string,
        recipeSlug: string,
        acceptLanguage?: (string | null),
        requestBody?: Body_trigger_action_api_households_recipe_actions__item_id__trigger__recipe_slug__post,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/recipe-actions/{item_id}/trigger/{recipe_slug}',
            path: {
                'item_id': itemId,
                'recipe_slug': recipeSlug,
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

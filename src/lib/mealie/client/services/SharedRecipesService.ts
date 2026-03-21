/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RecipeShareToken } from '../models/RecipeShareToken';
import type { RecipeShareTokenCreate } from '../models/RecipeShareTokenCreate';
import type { RecipeShareTokenSummary } from '../models/RecipeShareTokenSummary';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class SharedRecipesService {
    /**
     * Get All
     * @param recipeId
     * @param acceptLanguage
     * @returns RecipeShareTokenSummary Successful Response
     * @throws ApiError
     */
    public static getAllApiSharedRecipesGet(
        recipeId?: (string | null),
        acceptLanguage?: (string | null),
    ): CancelablePromise<Array<RecipeShareTokenSummary>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/shared/recipes',
            headers: {
                'accept-language': acceptLanguage,
            },
            query: {
                'recipe_id': recipeId,
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
     * @returns RecipeShareToken Successful Response
     * @throws ApiError
     */
    public static createOneApiSharedRecipesPost(
        requestBody: RecipeShareTokenCreate,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeShareToken> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/shared/recipes',
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
     * @returns RecipeShareToken Successful Response
     * @throws ApiError
     */
    public static getOneApiSharedRecipesItemIdGet(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeShareToken> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/shared/recipes/{item_id}',
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
     * Delete One
     * @param itemId
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static deleteOneApiSharedRecipesItemIdDelete(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/shared/recipes/{item_id}',
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

/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Recipe_Output } from '../models/Recipe_Output';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class RecipeSharedService {
    /**
     * Get Shared Recipe
     * @param tokenId
     * @returns Recipe_Output Successful Response
     * @throws ApiError
     */
    public static getSharedRecipeApiRecipesSharedTokenIdGet(
        tokenId: string,
    ): CancelablePromise<Recipe_Output> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/recipes/shared/{token_id}',
            path: {
                'token_id': tokenId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Shared Recipe As Zip
     * Get a recipe and its original image as a Zip file
     * @param tokenId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getSharedRecipeAsZipApiRecipesSharedTokenIdZipGet(
        tokenId: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/recipes/shared/{token_id}/zip',
            path: {
                'token_id': tokenId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}

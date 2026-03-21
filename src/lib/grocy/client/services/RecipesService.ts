/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RecipeFulfillmentResponse } from '../models/RecipeFulfillmentResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class RecipesService {
    /**
     * Adds all missing products for the given recipe to the shopping list
     * @param recipeId A valid recipe id
     * @param requestBody
     * @returns void
     * @throws ApiError
     */
    public static postRecipesAddNotFulfilledProductsToShoppinglist(
        recipeId: string,
        requestBody?: {
            /**
             * An optional array of product ids to exclude them from being put on the shopping list
             */
            excludedProductIds?: Array<number>;
        },
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/recipes/{recipeId}/add-not-fulfilled-products-to-shoppinglist',
            path: {
                'recipeId': recipeId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get stock fulfillment information for the given recipe
     * @param recipeId A valid recipe id
     * @returns RecipeFulfillmentResponse A RecipeFulfillmentResponse object
     * @throws ApiError
     */
    public static getRecipesFulfillment(
        recipeId: string,
    ): CancelablePromise<RecipeFulfillmentResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/recipes/{recipeId}/fulfillment',
            path: {
                'recipeId': recipeId,
            },
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
    /**
     * Consumes all in stock ingredients of the given recipe (for ingredients that are only partially in stock, the in stock amount will be consumed)
     * @param recipeId A valid recipe id
     * @returns void
     * @throws ApiError
     */
    public static postRecipesConsume(
        recipeId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/recipes/{recipeId}/consume',
            path: {
                'recipeId': recipeId,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Invalid recipe id, recipe need is not fulfilled)`,
            },
        });
    }
    /**
     * Get stock fulfillment information for all recipe
     * @param queryArray An array of filter conditions, each of them is a string in the form of `<field><condition><value>` where<br>`<field>` is a valid field name<br>`<condition>` is a comparison operator, one of<br>&nbsp;&nbsp;`=` equal<br>&nbsp;&nbsp;`!=` not equal<br>&nbsp;&nbsp;`~` LIKE<br>&nbsp;&nbsp;`!~` not LIKE<br>&nbsp;&nbsp;`<` less<br>&nbsp;&nbsp;`>` greater<br>&nbsp;&nbsp;`<=` less or equal<br>&nbsp;&nbsp;`>=` greater or equal<br>&nbsp;&nbsp;`§` regular expression<br>`<value>` is the value to search for
     * @param order A valid field name by which the response should be ordered, use the separator `:` to specify the sort order (`asc` or `desc`, defaults to `asc` when omitted)
     * @param limit The maximum number of objects to return
     * @param offset The number of objects to skip
     * @returns RecipeFulfillmentResponse An array of RecipeFulfillmentResponse objects
     * @throws ApiError
     */
    public static getRecipesFulfillment1(
        queryArray?: Array<string>,
        order?: string,
        limit?: number,
        offset?: number,
    ): CancelablePromise<Array<RecipeFulfillmentResponse>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/recipes/fulfillment',
            query: {
                'query[]': queryArray,
                'order': order,
                'limit': limit,
                'offset': offset,
            },
            errors: {
                400: `The operation was not successful`,
                500: `The operation was not successful (possible errors are invalid field names or conditions in filter parameters provided)`,
            },
        });
    }
    /**
     * Copies a recipe
     * @param recipeId A valid recipe id of the recipe to copy
     * @returns any The operation was successful
     * @throws ApiError
     */
    public static postRecipesCopy(
        recipeId: number,
    ): CancelablePromise<{
        /**
         * The id of the created recipe
         */
        created_object_id?: number;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/recipes/{recipeId}/copy',
            path: {
                'recipeId': recipeId,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Invalid recipe id)`,
            },
        });
    }
    /**
     * Prints the Grocycode label of the given recipe on the configured label printer
     * @param recipeId A valid recipe id
     * @returns any The operation was successful
     * @throws ApiError
     */
    public static getRecipesPrintlabel(
        recipeId: number,
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/recipes/{recipeId}/printlabel',
            path: {
                'recipeId': recipeId,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Not existing recipe, error on WebHook execution)`,
            },
        });
    }
}

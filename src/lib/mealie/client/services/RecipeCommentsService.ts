/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { RecipeCommentCreate } from '../models/RecipeCommentCreate';
import type { RecipeCommentOut_Output } from '../models/RecipeCommentOut_Output';
import type { RecipeCommentPagination } from '../models/RecipeCommentPagination';
import type { RecipeCommentUpdate } from '../models/RecipeCommentUpdate';
import type { SuccessResponse } from '../models/SuccessResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class RecipeCommentsService {
    /**
     * Get Recipe Comments
     * Get all comments for a recipe
     * @param slug
     * @param acceptLanguage
     * @returns RecipeCommentOut_Output Successful Response
     * @throws ApiError
     */
    public static getRecipeCommentsApiRecipesSlugCommentsGet(
        slug: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<Array<RecipeCommentOut_Output>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/recipes/{slug}/comments',
            path: {
                'slug': slug,
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
     * Get All
     * @param orderBy
     * @param orderByNullPosition
     * @param orderDirection
     * @param queryFilter
     * @param paginationSeed
     * @param page
     * @param perPage
     * @param acceptLanguage
     * @returns RecipeCommentPagination Successful Response
     * @throws ApiError
     */
    public static getAllApiCommentsGet(
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeCommentPagination> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/comments',
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
     * @returns RecipeCommentOut_Output Successful Response
     * @throws ApiError
     */
    public static createOneApiCommentsPost(
        requestBody: RecipeCommentCreate,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeCommentOut_Output> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/comments',
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
     * @returns RecipeCommentOut_Output Successful Response
     * @throws ApiError
     */
    public static getOneApiCommentsItemIdGet(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeCommentOut_Output> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/comments/{item_id}',
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
     * @returns RecipeCommentOut_Output Successful Response
     * @throws ApiError
     */
    public static updateOneApiCommentsItemIdPut(
        itemId: string,
        requestBody: RecipeCommentUpdate,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeCommentOut_Output> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/comments/{item_id}',
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
    public static deleteOneApiCommentsItemIdDelete(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<SuccessResponse> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/comments/{item_id}',
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

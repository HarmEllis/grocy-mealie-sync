/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateIngredientUnit } from '../models/CreateIngredientUnit';
import type { IngredientUnit_Output } from '../models/IngredientUnit_Output';
import type { IngredientUnitPagination } from '../models/IngredientUnitPagination';
import type { MergeUnit } from '../models/MergeUnit';
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { SuccessResponse } from '../models/SuccessResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class RecipesUnitsService {
    /**
     * Get All
     * @param search
     * @param orderBy
     * @param orderByNullPosition
     * @param orderDirection
     * @param queryFilter
     * @param paginationSeed
     * @param page
     * @param perPage
     * @param acceptLanguage
     * @returns IngredientUnitPagination Successful Response
     * @throws ApiError
     */
    public static getAllApiUnitsGet(
        search?: (string | null),
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<IngredientUnitPagination> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/units',
            headers: {
                'accept-language': acceptLanguage,
            },
            query: {
                'search': search,
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
     * @returns IngredientUnit_Output Successful Response
     * @throws ApiError
     */
    public static createOneApiUnitsPost(
        requestBody: CreateIngredientUnit,
        acceptLanguage?: (string | null),
    ): CancelablePromise<IngredientUnit_Output> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/units',
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
     * Merge One
     * @param requestBody
     * @param acceptLanguage
     * @returns SuccessResponse Successful Response
     * @throws ApiError
     */
    public static mergeOneApiUnitsMergePut(
        requestBody: MergeUnit,
        acceptLanguage?: (string | null),
    ): CancelablePromise<SuccessResponse> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/units/merge',
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
     * @returns IngredientUnit_Output Successful Response
     * @throws ApiError
     */
    public static getOneApiUnitsItemIdGet(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<IngredientUnit_Output> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/units/{item_id}',
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
     * @returns IngredientUnit_Output Successful Response
     * @throws ApiError
     */
    public static updateOneApiUnitsItemIdPut(
        itemId: string,
        requestBody: CreateIngredientUnit,
        acceptLanguage?: (string | null),
    ): CancelablePromise<IngredientUnit_Output> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/units/{item_id}',
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
     * @returns IngredientUnit_Output Successful Response
     * @throws ApiError
     */
    public static deleteOneApiUnitsItemIdDelete(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<IngredientUnit_Output> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/units/{item_id}',
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

/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CookBookPagination } from '../models/CookBookPagination';
import type { CreateCookBook } from '../models/CreateCookBook';
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { ReadCookBook } from '../models/ReadCookBook';
import type { UpdateCookBook } from '../models/UpdateCookBook';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class HouseholdsCookbooksService {
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
     * @returns CookBookPagination Successful Response
     * @throws ApiError
     */
    public static getAllApiHouseholdsCookbooksGet(
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<CookBookPagination> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/cookbooks',
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
     * @returns ReadCookBook Successful Response
     * @throws ApiError
     */
    public static createOneApiHouseholdsCookbooksPost(
        requestBody: CreateCookBook,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ReadCookBook> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/cookbooks',
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
     * @returns ReadCookBook Successful Response
     * @throws ApiError
     */
    public static updateManyApiHouseholdsCookbooksPut(
        requestBody: Array<UpdateCookBook>,
        acceptLanguage?: (string | null),
    ): CancelablePromise<Array<ReadCookBook>> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/households/cookbooks',
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
     * @returns ReadCookBook Successful Response
     * @throws ApiError
     */
    public static getOneApiHouseholdsCookbooksItemIdGet(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ReadCookBook> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/cookbooks/{item_id}',
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
     * @returns ReadCookBook Successful Response
     * @throws ApiError
     */
    public static updateOneApiHouseholdsCookbooksItemIdPut(
        itemId: string,
        requestBody: CreateCookBook,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ReadCookBook> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/households/cookbooks/{item_id}',
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
     * @returns ReadCookBook Successful Response
     * @throws ApiError
     */
    public static deleteOneApiHouseholdsCookbooksItemIdDelete(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ReadCookBook> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/households/cookbooks/{item_id}',
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

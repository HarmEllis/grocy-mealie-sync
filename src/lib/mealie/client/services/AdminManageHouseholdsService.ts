/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { HouseholdCreate } from '../models/HouseholdCreate';
import type { HouseholdInDB } from '../models/HouseholdInDB';
import type { HouseholdPagination } from '../models/HouseholdPagination';
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { UpdateHouseholdAdmin } from '../models/UpdateHouseholdAdmin';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AdminManageHouseholdsService {
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
     * @returns HouseholdPagination Successful Response
     * @throws ApiError
     */
    public static getAllApiAdminHouseholdsGet(
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<HouseholdPagination> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/admin/households',
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
     * @returns HouseholdInDB Successful Response
     * @throws ApiError
     */
    public static createOneApiAdminHouseholdsPost(
        requestBody: HouseholdCreate,
        acceptLanguage?: (string | null),
    ): CancelablePromise<HouseholdInDB> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/admin/households',
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
     * @returns HouseholdInDB Successful Response
     * @throws ApiError
     */
    public static getOneApiAdminHouseholdsItemIdGet(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<HouseholdInDB> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/admin/households/{item_id}',
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
     * @returns HouseholdInDB Successful Response
     * @throws ApiError
     */
    public static updateOneApiAdminHouseholdsItemIdPut(
        itemId: string,
        requestBody: UpdateHouseholdAdmin,
        acceptLanguage?: (string | null),
    ): CancelablePromise<HouseholdInDB> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/admin/households/{item_id}',
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
     * @returns HouseholdInDB Successful Response
     * @throws ApiError
     */
    public static deleteOneApiAdminHouseholdsItemIdDelete(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<HouseholdInDB> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/admin/households/{item_id}',
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

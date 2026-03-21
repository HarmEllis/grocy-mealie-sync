/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GroupAdminUpdate } from '../models/GroupAdminUpdate';
import type { GroupBase } from '../models/GroupBase';
import type { GroupInDB } from '../models/GroupInDB';
import type { GroupPagination } from '../models/GroupPagination';
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AdminManageGroupsService {
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
     * @returns GroupPagination Successful Response
     * @throws ApiError
     */
    public static getAllApiAdminGroupsGet(
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<GroupPagination> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/admin/groups',
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
     * @returns GroupInDB Successful Response
     * @throws ApiError
     */
    public static createOneApiAdminGroupsPost(
        requestBody: GroupBase,
        acceptLanguage?: (string | null),
    ): CancelablePromise<GroupInDB> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/admin/groups',
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
     * @returns GroupInDB Successful Response
     * @throws ApiError
     */
    public static getOneApiAdminGroupsItemIdGet(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<GroupInDB> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/admin/groups/{item_id}',
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
     * @returns GroupInDB Successful Response
     * @throws ApiError
     */
    public static updateOneApiAdminGroupsItemIdPut(
        itemId: string,
        requestBody: GroupAdminUpdate,
        acceptLanguage?: (string | null),
    ): CancelablePromise<GroupInDB> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/admin/groups/{item_id}',
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
     * @returns GroupInDB Successful Response
     * @throws ApiError
     */
    public static deleteOneApiAdminGroupsItemIdDelete(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<GroupInDB> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/admin/groups/{item_id}',
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

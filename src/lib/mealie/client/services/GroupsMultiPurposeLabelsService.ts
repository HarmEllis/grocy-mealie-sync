/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MultiPurposeLabelCreate } from '../models/MultiPurposeLabelCreate';
import type { MultiPurposeLabelOut } from '../models/MultiPurposeLabelOut';
import type { MultiPurposeLabelPagination } from '../models/MultiPurposeLabelPagination';
import type { MultiPurposeLabelUpdate } from '../models/MultiPurposeLabelUpdate';
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class GroupsMultiPurposeLabelsService {
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
     * @returns MultiPurposeLabelPagination Successful Response
     * @throws ApiError
     */
    public static getAllApiGroupsLabelsGet(
        search?: (string | null),
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<MultiPurposeLabelPagination> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/groups/labels',
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
     * @returns MultiPurposeLabelOut Successful Response
     * @throws ApiError
     */
    public static createOneApiGroupsLabelsPost(
        requestBody: MultiPurposeLabelCreate,
        acceptLanguage?: (string | null),
    ): CancelablePromise<MultiPurposeLabelOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/groups/labels',
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
     * @returns MultiPurposeLabelOut Successful Response
     * @throws ApiError
     */
    public static getOneApiGroupsLabelsItemIdGet(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<MultiPurposeLabelOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/groups/labels/{item_id}',
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
     * @returns MultiPurposeLabelOut Successful Response
     * @throws ApiError
     */
    public static updateOneApiGroupsLabelsItemIdPut(
        itemId: string,
        requestBody: MultiPurposeLabelUpdate,
        acceptLanguage?: (string | null),
    ): CancelablePromise<MultiPurposeLabelOut> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/groups/labels/{item_id}',
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
     * @returns MultiPurposeLabelOut Successful Response
     * @throws ApiError
     */
    public static deleteOneApiGroupsLabelsItemIdDelete(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<MultiPurposeLabelOut> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/groups/labels/{item_id}',
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

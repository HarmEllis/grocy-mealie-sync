/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GroupEventNotifierCreate } from '../models/GroupEventNotifierCreate';
import type { GroupEventNotifierOut } from '../models/GroupEventNotifierOut';
import type { GroupEventNotifierUpdate } from '../models/GroupEventNotifierUpdate';
import type { GroupEventPagination } from '../models/GroupEventPagination';
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class HouseholdsEventNotificationsService {
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
     * @returns GroupEventPagination Successful Response
     * @throws ApiError
     */
    public static getAllApiHouseholdsEventsNotificationsGet(
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<GroupEventPagination> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/events/notifications',
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
     * @returns GroupEventNotifierOut Successful Response
     * @throws ApiError
     */
    public static createOneApiHouseholdsEventsNotificationsPost(
        requestBody: GroupEventNotifierCreate,
        acceptLanguage?: (string | null),
    ): CancelablePromise<GroupEventNotifierOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/events/notifications',
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
     * @returns GroupEventNotifierOut Successful Response
     * @throws ApiError
     */
    public static getOneApiHouseholdsEventsNotificationsItemIdGet(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<GroupEventNotifierOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/events/notifications/{item_id}',
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
     * @returns GroupEventNotifierOut Successful Response
     * @throws ApiError
     */
    public static updateOneApiHouseholdsEventsNotificationsItemIdPut(
        itemId: string,
        requestBody: GroupEventNotifierUpdate,
        acceptLanguage?: (string | null),
    ): CancelablePromise<GroupEventNotifierOut> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/households/events/notifications/{item_id}',
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
     * @returns void
     * @throws ApiError
     */
    public static deleteOneApiHouseholdsEventsNotificationsItemIdDelete(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/households/events/notifications/{item_id}',
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
     * Test Notification
     * @param itemId
     * @param acceptLanguage
     * @returns void
     * @throws ApiError
     */
    public static testNotificationApiHouseholdsEventsNotificationsItemIdTestPost(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/events/notifications/{item_id}/test',
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

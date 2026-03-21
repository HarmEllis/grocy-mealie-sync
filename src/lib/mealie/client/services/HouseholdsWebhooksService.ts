/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateWebhook } from '../models/CreateWebhook';
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { ReadWebhook } from '../models/ReadWebhook';
import type { WebhookPagination } from '../models/WebhookPagination';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class HouseholdsWebhooksService {
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
     * @returns WebhookPagination Successful Response
     * @throws ApiError
     */
    public static getAllApiHouseholdsWebhooksGet(
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<WebhookPagination> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/webhooks',
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
     * @returns ReadWebhook Successful Response
     * @throws ApiError
     */
    public static createOneApiHouseholdsWebhooksPost(
        requestBody: CreateWebhook,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ReadWebhook> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/webhooks',
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
     * Rerun Webhooks
     * Manually re-fires all previously scheduled webhooks for today
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static rerunWebhooksApiHouseholdsWebhooksRerunPost(
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/webhooks/rerun',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get One
     * @param itemId
     * @param acceptLanguage
     * @returns ReadWebhook Successful Response
     * @throws ApiError
     */
    public static getOneApiHouseholdsWebhooksItemIdGet(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ReadWebhook> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/webhooks/{item_id}',
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
     * @returns ReadWebhook Successful Response
     * @throws ApiError
     */
    public static updateOneApiHouseholdsWebhooksItemIdPut(
        itemId: string,
        requestBody: CreateWebhook,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ReadWebhook> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/households/webhooks/{item_id}',
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
     * @returns ReadWebhook Successful Response
     * @throws ApiError
     */
    public static deleteOneApiHouseholdsWebhooksItemIdDelete(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ReadWebhook> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/households/webhooks/{item_id}',
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
     * Test One
     * @param itemId
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static testOneApiHouseholdsWebhooksItemIdTestPost(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/webhooks/{item_id}/test',
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

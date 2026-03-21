/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Body_update_event_image_api_recipes_timeline_events__item_id__image_put } from '../models/Body_update_event_image_api_recipes_timeline_events__item_id__image_put';
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { RecipeTimelineEventIn } from '../models/RecipeTimelineEventIn';
import type { RecipeTimelineEventOut } from '../models/RecipeTimelineEventOut';
import type { RecipeTimelineEventPagination } from '../models/RecipeTimelineEventPagination';
import type { RecipeTimelineEventUpdate } from '../models/RecipeTimelineEventUpdate';
import type { UpdateImageResponse } from '../models/UpdateImageResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class RecipeTimelineService {
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
     * @returns RecipeTimelineEventPagination Successful Response
     * @throws ApiError
     */
    public static getAllApiRecipesTimelineEventsGet(
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeTimelineEventPagination> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/recipes/timeline/events',
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
     * @returns RecipeTimelineEventOut Successful Response
     * @throws ApiError
     */
    public static createOneApiRecipesTimelineEventsPost(
        requestBody: RecipeTimelineEventIn,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeTimelineEventOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/recipes/timeline/events',
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
     * @returns RecipeTimelineEventOut Successful Response
     * @throws ApiError
     */
    public static getOneApiRecipesTimelineEventsItemIdGet(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeTimelineEventOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/recipes/timeline/events/{item_id}',
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
     * @returns RecipeTimelineEventOut Successful Response
     * @throws ApiError
     */
    public static updateOneApiRecipesTimelineEventsItemIdPut(
        itemId: string,
        requestBody: RecipeTimelineEventUpdate,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeTimelineEventOut> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/recipes/timeline/events/{item_id}',
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
     * @returns RecipeTimelineEventOut Successful Response
     * @throws ApiError
     */
    public static deleteOneApiRecipesTimelineEventsItemIdDelete(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeTimelineEventOut> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/recipes/timeline/events/{item_id}',
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
     * Update Event Image
     * @param itemId
     * @param formData
     * @param acceptLanguage
     * @returns UpdateImageResponse Successful Response
     * @throws ApiError
     */
    public static updateEventImageApiRecipesTimelineEventsItemIdImagePut(
        itemId: string,
        formData: Body_update_event_image_api_recipes_timeline_events__item_id__image_put,
        acceptLanguage?: (string | null),
    ): CancelablePromise<UpdateImageResponse> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/recipes/timeline/events/{item_id}/image',
            path: {
                'item_id': itemId,
            },
            headers: {
                'accept-language': acceptLanguage,
            },
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}

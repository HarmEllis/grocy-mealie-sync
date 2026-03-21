/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreatePlanEntry } from '../models/CreatePlanEntry';
import type { CreateRandomEntry } from '../models/CreateRandomEntry';
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { PlanEntryPagination } from '../models/PlanEntryPagination';
import type { ReadPlanEntry } from '../models/ReadPlanEntry';
import type { UpdatePlanEntry } from '../models/UpdatePlanEntry';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class HouseholdsMealplansService {
    /**
     * Get All
     * @param startDate
     * @param endDate
     * @param orderBy
     * @param orderByNullPosition
     * @param orderDirection
     * @param queryFilter
     * @param paginationSeed
     * @param page
     * @param perPage
     * @param acceptLanguage
     * @returns PlanEntryPagination Successful Response
     * @throws ApiError
     */
    public static getAllApiHouseholdsMealplansGet(
        startDate?: (string | null),
        endDate?: (string | null),
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<PlanEntryPagination> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/mealplans',
            headers: {
                'accept-language': acceptLanguage,
            },
            query: {
                'start_date': startDate,
                'end_date': endDate,
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
     * @returns ReadPlanEntry Successful Response
     * @throws ApiError
     */
    public static createOneApiHouseholdsMealplansPost(
        requestBody: CreatePlanEntry,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ReadPlanEntry> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/mealplans',
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
     * Get Todays Meals
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getTodaysMealsApiHouseholdsMealplansTodayGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/mealplans/today',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create Random Meal
     * `create_random_meal` is a route that provides the randomized functionality for mealplaners.
     * It operates by following the rules set out in the household's mealplan settings. If no settings
     * are set, it will return any random meal.
     *
     * Refer to the mealplan settings routes for more information on how rules can be applied
     * to the random meal selector.
     * @param requestBody
     * @param acceptLanguage
     * @returns ReadPlanEntry Successful Response
     * @throws ApiError
     */
    public static createRandomMealApiHouseholdsMealplansRandomPost(
        requestBody: CreateRandomEntry,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ReadPlanEntry> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/mealplans/random',
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
     * @returns ReadPlanEntry Successful Response
     * @throws ApiError
     */
    public static getOneApiHouseholdsMealplansItemIdGet(
        itemId: number,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ReadPlanEntry> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/mealplans/{item_id}',
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
     * @returns ReadPlanEntry Successful Response
     * @throws ApiError
     */
    public static updateOneApiHouseholdsMealplansItemIdPut(
        itemId: number,
        requestBody: UpdatePlanEntry,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ReadPlanEntry> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/households/mealplans/{item_id}',
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
     * @returns ReadPlanEntry Successful Response
     * @throws ApiError
     */
    public static deleteOneApiHouseholdsMealplansItemIdDelete(
        itemId: number,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ReadPlanEntry> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/households/mealplans/{item_id}',
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

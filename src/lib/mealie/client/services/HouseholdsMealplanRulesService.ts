/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { PlanRulesCreate } from '../models/PlanRulesCreate';
import type { PlanRulesOut } from '../models/PlanRulesOut';
import type { PlanRulesPagination } from '../models/PlanRulesPagination';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class HouseholdsMealplanRulesService {
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
     * @returns PlanRulesPagination Successful Response
     * @throws ApiError
     */
    public static getAllApiHouseholdsMealplansRulesGet(
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<PlanRulesPagination> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/mealplans/rules',
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
     * @returns PlanRulesOut Successful Response
     * @throws ApiError
     */
    public static createOneApiHouseholdsMealplansRulesPost(
        requestBody: PlanRulesCreate,
        acceptLanguage?: (string | null),
    ): CancelablePromise<PlanRulesOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/mealplans/rules',
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
     * @returns PlanRulesOut Successful Response
     * @throws ApiError
     */
    public static getOneApiHouseholdsMealplansRulesItemIdGet(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<PlanRulesOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/mealplans/rules/{item_id}',
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
     * @returns PlanRulesOut Successful Response
     * @throws ApiError
     */
    public static updateOneApiHouseholdsMealplansRulesItemIdPut(
        itemId: string,
        requestBody: PlanRulesCreate,
        acceptLanguage?: (string | null),
    ): CancelablePromise<PlanRulesOut> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/households/mealplans/rules/{item_id}',
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
     * @returns PlanRulesOut Successful Response
     * @throws ApiError
     */
    public static deleteOneApiHouseholdsMealplansRulesItemIdDelete(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<PlanRulesOut> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/households/mealplans/rules/{item_id}',
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

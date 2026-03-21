/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { HouseholdInDB } from '../models/HouseholdInDB';
import type { HouseholdRecipeSummary } from '../models/HouseholdRecipeSummary';
import type { HouseholdStatistics } from '../models/HouseholdStatistics';
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { PaginationBase_UserOut_ } from '../models/PaginationBase_UserOut_';
import type { ReadHouseholdPreferences } from '../models/ReadHouseholdPreferences';
import type { SetPermissions } from '../models/SetPermissions';
import type { UpdateHouseholdPreferences } from '../models/UpdateHouseholdPreferences';
import type { UserOut } from '../models/UserOut';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class HouseholdsSelfServiceService {
    /**
     * Get Logged In User Household
     * Returns the Household Data for the Current User
     * @param acceptLanguage
     * @returns HouseholdInDB Successful Response
     * @throws ApiError
     */
    public static getLoggedInUserHouseholdApiHouseholdsSelfGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<HouseholdInDB> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/self',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Household Recipe
     * Returns recipe data for the current household
     * @param recipeSlug
     * @param acceptLanguage
     * @returns HouseholdRecipeSummary Successful Response
     * @throws ApiError
     */
    public static getHouseholdRecipeApiHouseholdsSelfRecipesRecipeSlugGet(
        recipeSlug: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<HouseholdRecipeSummary> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/self/recipes/{recipe_slug}',
            path: {
                'recipe_slug': recipeSlug,
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
     * Get Household Members
     * Returns all users belonging to the current household
     * @param orderBy
     * @param orderByNullPosition
     * @param orderDirection
     * @param queryFilter
     * @param paginationSeed
     * @param page
     * @param perPage
     * @param acceptLanguage
     * @returns PaginationBase_UserOut_ Successful Response
     * @throws ApiError
     */
    public static getHouseholdMembersApiHouseholdsMembersGet(
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<PaginationBase_UserOut_> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/members',
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
     * Get Household Preferences
     * @param acceptLanguage
     * @returns ReadHouseholdPreferences Successful Response
     * @throws ApiError
     */
    public static getHouseholdPreferencesApiHouseholdsPreferencesGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<ReadHouseholdPreferences> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/preferences',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Household Preferences
     * @param requestBody
     * @param acceptLanguage
     * @returns ReadHouseholdPreferences Successful Response
     * @throws ApiError
     */
    public static updateHouseholdPreferencesApiHouseholdsPreferencesPut(
        requestBody: UpdateHouseholdPreferences,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ReadHouseholdPreferences> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/households/preferences',
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
     * Set Member Permissions
     * @param requestBody
     * @param acceptLanguage
     * @returns UserOut Successful Response
     * @throws ApiError
     */
    public static setMemberPermissionsApiHouseholdsPermissionsPut(
        requestBody: SetPermissions,
        acceptLanguage?: (string | null),
    ): CancelablePromise<UserOut> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/households/permissions',
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
     * Get Statistics
     * @param acceptLanguage
     * @returns HouseholdStatistics Successful Response
     * @throws ApiError
     */
    public static getStatisticsApiHouseholdsStatisticsGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<HouseholdStatistics> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/statistics',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}

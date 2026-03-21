/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { HouseholdSummary } from '../models/HouseholdSummary';
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { PaginationBase_HouseholdSummary_ } from '../models/PaginationBase_HouseholdSummary_';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ExploreHouseholdsService {
    /**
     * Get All
     * @param groupSlug
     * @param orderBy
     * @param orderByNullPosition
     * @param orderDirection
     * @param queryFilter
     * @param paginationSeed
     * @param page
     * @param perPage
     * @param acceptLanguage
     * @returns PaginationBase_HouseholdSummary_ Successful Response
     * @throws ApiError
     */
    public static getAllApiExploreGroupsGroupSlugHouseholdsGet(
        groupSlug: string,
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<PaginationBase_HouseholdSummary_> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/explore/groups/{group_slug}/households',
            path: {
                'group_slug': groupSlug,
            },
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
     * Get Household
     * @param householdSlug
     * @param groupSlug
     * @param acceptLanguage
     * @returns HouseholdSummary Successful Response
     * @throws ApiError
     */
    public static getHouseholdApiExploreGroupsGroupSlugHouseholdsHouseholdSlugGet(
        householdSlug: string,
        groupSlug: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<HouseholdSummary> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/explore/groups/{group_slug}/households/{household_slug}',
            path: {
                'household_slug': householdSlug,
                'group_slug': groupSlug,
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

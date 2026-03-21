/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CategoryOut } from '../models/CategoryOut';
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { PaginationBase_RecipeCategory_ } from '../models/PaginationBase_RecipeCategory_';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ExploreCategoriesService {
    /**
     * Get All
     * @param groupSlug
     * @param search
     * @param orderBy
     * @param orderByNullPosition
     * @param orderDirection
     * @param queryFilter
     * @param paginationSeed
     * @param page
     * @param perPage
     * @param acceptLanguage
     * @returns PaginationBase_RecipeCategory_ Successful Response
     * @throws ApiError
     */
    public static getAllApiExploreGroupsGroupSlugOrganizersCategoriesGet(
        groupSlug: string,
        search?: (string | null),
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<PaginationBase_RecipeCategory_> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/explore/groups/{group_slug}/organizers/categories',
            path: {
                'group_slug': groupSlug,
            },
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
     * Get One
     * @param itemId
     * @param groupSlug
     * @param acceptLanguage
     * @returns CategoryOut Successful Response
     * @throws ApiError
     */
    public static getOneApiExploreGroupsGroupSlugOrganizersCategoriesItemIdGet(
        itemId: string,
        groupSlug: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<CategoryOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/explore/groups/{group_slug}/organizers/categories/{item_id}',
            path: {
                'item_id': itemId,
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

/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { PaginationBase_ReadCookBook_ } from '../models/PaginationBase_ReadCookBook_';
import type { ReadCookBook } from '../models/ReadCookBook';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ExploreCookbooksService {
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
     * @returns PaginationBase_ReadCookBook_ Successful Response
     * @throws ApiError
     */
    public static getAllApiExploreGroupsGroupSlugCookbooksGet(
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
    ): CancelablePromise<PaginationBase_ReadCookBook_> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/explore/groups/{group_slug}/cookbooks',
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
     * @returns ReadCookBook Successful Response
     * @throws ApiError
     */
    public static getOneApiExploreGroupsGroupSlugCookbooksItemIdGet(
        itemId: string,
        groupSlug: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ReadCookBook> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/explore/groups/{group_slug}/cookbooks/{item_id}',
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

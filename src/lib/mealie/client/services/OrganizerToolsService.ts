/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { RecipeTool } from '../models/RecipeTool';
import type { RecipeToolCreate } from '../models/RecipeToolCreate';
import type { RecipeToolPagination } from '../models/RecipeToolPagination';
import type { RecipeToolResponse } from '../models/RecipeToolResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class OrganizerToolsService {
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
     * @returns RecipeToolPagination Successful Response
     * @throws ApiError
     */
    public static getAllApiOrganizersToolsGet(
        search?: (string | null),
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeToolPagination> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/organizers/tools',
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
     * @returns RecipeTool Successful Response
     * @throws ApiError
     */
    public static createOneApiOrganizersToolsPost(
        requestBody: RecipeToolCreate,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeTool> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/organizers/tools',
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
     * @returns RecipeTool Successful Response
     * @throws ApiError
     */
    public static getOneApiOrganizersToolsItemIdGet(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeTool> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/organizers/tools/{item_id}',
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
     * @returns RecipeTool Successful Response
     * @throws ApiError
     */
    public static updateOneApiOrganizersToolsItemIdPut(
        itemId: string,
        requestBody: RecipeToolCreate,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeTool> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/organizers/tools/{item_id}',
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
     * @returns RecipeTool Successful Response
     * @throws ApiError
     */
    public static deleteOneApiOrganizersToolsItemIdDelete(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeTool> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/organizers/tools/{item_id}',
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
     * Get One By Slug
     * @param toolSlug
     * @param acceptLanguage
     * @returns RecipeToolResponse Successful Response
     * @throws ApiError
     */
    public static getOneBySlugApiOrganizersToolsSlugToolSlugGet(
        toolSlug: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeToolResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/organizers/tools/slug/{tool_slug}',
            path: {
                'tool_slug': toolSlug,
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

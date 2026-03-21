/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { RecipeTagPagination } from '../models/RecipeTagPagination';
import type { RecipeTagResponse } from '../models/RecipeTagResponse';
import type { TagIn } from '../models/TagIn';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class OrganizerTagsService {
    /**
     * Get All
     * Returns a list of available tags in the database
     * @param search
     * @param orderBy
     * @param orderByNullPosition
     * @param orderDirection
     * @param queryFilter
     * @param paginationSeed
     * @param page
     * @param perPage
     * @param acceptLanguage
     * @returns RecipeTagPagination Successful Response
     * @throws ApiError
     */
    public static getAllApiOrganizersTagsGet(
        search?: (string | null),
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeTagPagination> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/organizers/tags',
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
     * Creates a Tag in the database
     * @param requestBody
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static createOneApiOrganizersTagsPost(
        requestBody: TagIn,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/organizers/tags',
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
     * Get Empty Tags
     * Returns a list of tags that do not contain any recipes
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getEmptyTagsApiOrganizersTagsEmptyGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/organizers/tags/empty',
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
     * Returns a list of recipes associated with the provided tag.
     * @param itemId
     * @param acceptLanguage
     * @returns RecipeTagResponse Successful Response
     * @throws ApiError
     */
    public static getOneApiOrganizersTagsItemIdGet(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeTagResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/organizers/tags/{item_id}',
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
     * Updates an existing Tag in the database
     * @param itemId
     * @param requestBody
     * @param acceptLanguage
     * @returns RecipeTagResponse Successful Response
     * @throws ApiError
     */
    public static updateOneApiOrganizersTagsItemIdPut(
        itemId: string,
        requestBody: TagIn,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeTagResponse> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/organizers/tags/{item_id}',
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
     * Delete Recipe Tag
     * Removes a recipe tag from the database. Deleting a
     * tag does not impact a recipe. The tag will be removed
     * from any recipes that contain it
     * @param itemId
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static deleteRecipeTagApiOrganizersTagsItemIdDelete(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/organizers/tags/{item_id}',
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
     * @param tagSlug
     * @param acceptLanguage
     * @returns RecipeTagResponse Successful Response
     * @throws ApiError
     */
    public static getOneBySlugApiOrganizersTagsSlugTagSlugGet(
        tagSlug: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeTagResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/organizers/tags/slug/{tag_slug}',
            path: {
                'tag_slug': tagSlug,
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

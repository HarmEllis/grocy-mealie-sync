/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CategoryBase } from '../models/CategoryBase';
import type { CategoryIn } from '../models/CategoryIn';
import type { CategorySummary } from '../models/CategorySummary';
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { RecipeCategoryPagination } from '../models/RecipeCategoryPagination';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class OrganizerCategoriesService {
    /**
     * Get All
     * Returns a list of available categories in the database
     * @param search
     * @param orderBy
     * @param orderByNullPosition
     * @param orderDirection
     * @param queryFilter
     * @param paginationSeed
     * @param page
     * @param perPage
     * @param acceptLanguage
     * @returns RecipeCategoryPagination Successful Response
     * @throws ApiError
     */
    public static getAllApiOrganizersCategoriesGet(
        search?: (string | null),
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeCategoryPagination> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/organizers/categories',
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
     * Creates a Category in the database
     * @param requestBody
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static createOneApiOrganizersCategoriesPost(
        requestBody: CategoryIn,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/organizers/categories',
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
     * Get All Empty
     * Returns a list of categories that do not contain any recipes
     * @param acceptLanguage
     * @returns CategoryBase Successful Response
     * @throws ApiError
     */
    public static getAllEmptyApiOrganizersCategoriesEmptyGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<Array<CategoryBase>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/organizers/categories/empty',
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
     * Returns a list of recipes associated with the provided category.
     * @param itemId
     * @param acceptLanguage
     * @returns CategorySummary Successful Response
     * @throws ApiError
     */
    public static getOneApiOrganizersCategoriesItemIdGet(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<CategorySummary> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/organizers/categories/{item_id}',
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
     * @returns CategorySummary Successful Response
     * @throws ApiError
     */
    public static updateOneApiOrganizersCategoriesItemIdPut(
        itemId: string,
        requestBody: CategoryIn,
        acceptLanguage?: (string | null),
    ): CancelablePromise<CategorySummary> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/organizers/categories/{item_id}',
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
     * Removes a recipe category from the database. Deleting a
     * category does not impact a recipe. The category will be removed
     * from any recipes that contain it
     * @param itemId
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static deleteOneApiOrganizersCategoriesItemIdDelete(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/organizers/categories/{item_id}',
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
     * Returns a category object with the associated recieps relating to the category
     * @param categorySlug
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getOneBySlugApiOrganizersCategoriesSlugCategorySlugGet(
        categorySlug: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/organizers/categories/slug/{category_slug}',
            path: {
                'category_slug': categorySlug,
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

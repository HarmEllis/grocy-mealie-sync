/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserRatings_UserRatingOut_ } from '../models/UserRatings_UserRatingOut_';
import type { UserRatingUpdate } from '../models/UserRatingUpdate';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class UsersRatingsService {
    /**
     * Get Ratings
     * Get user's rated recipes
     * @param id
     * @param acceptLanguage
     * @returns UserRatings_UserRatingOut_ Successful Response
     * @throws ApiError
     */
    public static getRatingsApiUsersIdRatingsGet(
        id: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<UserRatings_UserRatingOut_> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/users/{id}/ratings',
            path: {
                'id': id,
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
     * Get Favorites
     * Get user's favorited recipes
     * @param id
     * @param acceptLanguage
     * @returns UserRatings_UserRatingOut_ Successful Response
     * @throws ApiError
     */
    public static getFavoritesApiUsersIdFavoritesGet(
        id: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<UserRatings_UserRatingOut_> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/users/{id}/favorites',
            path: {
                'id': id,
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
     * Set Rating
     * Sets the user's rating for a recipe
     * @param id
     * @param slug
     * @param requestBody
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static setRatingApiUsersIdRatingsSlugPost(
        id: string,
        slug: string,
        requestBody: UserRatingUpdate,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/users/{id}/ratings/{slug}',
            path: {
                'id': id,
                'slug': slug,
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
     * Add Favorite
     * Adds a recipe to the user's favorites
     * @param id
     * @param slug
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static addFavoriteApiUsersIdFavoritesSlugPost(
        id: string,
        slug: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/users/{id}/favorites/{slug}',
            path: {
                'id': id,
                'slug': slug,
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
     * Remove Favorite
     * Removes a recipe from the user's favorites
     * @param id
     * @param slug
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static removeFavoriteApiUsersIdFavoritesSlugDelete(
        id: string,
        slug: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/users/{id}/favorites/{slug}',
            path: {
                'id': id,
                'slug': slug,
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

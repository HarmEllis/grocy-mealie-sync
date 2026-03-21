/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChangePassword } from '../models/ChangePassword';
import type { mealie__schema__user__user__UserBase } from '../models/mealie__schema__user__user__UserBase';
import type { UserOut } from '../models/UserOut';
import type { UserRatings_UserRatingSummary_ } from '../models/UserRatings_UserRatingSummary_';
import type { UserRatingSummary } from '../models/UserRatingSummary';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class UsersCrudService {
    /**
     * Get Logged In User
     * @param acceptLanguage
     * @returns UserOut Successful Response
     * @throws ApiError
     */
    public static getLoggedInUserApiUsersSelfGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<UserOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/users/self',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Logged In User Ratings
     * @param acceptLanguage
     * @returns UserRatings_UserRatingSummary_ Successful Response
     * @throws ApiError
     */
    public static getLoggedInUserRatingsApiUsersSelfRatingsGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<UserRatings_UserRatingSummary_> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/users/self/ratings',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Logged In User Rating For Recipe
     * @param recipeId
     * @param acceptLanguage
     * @returns UserRatingSummary Successful Response
     * @throws ApiError
     */
    public static getLoggedInUserRatingForRecipeApiUsersSelfRatingsRecipeIdGet(
        recipeId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<UserRatingSummary> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/users/self/ratings/{recipe_id}',
            path: {
                'recipe_id': recipeId,
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
     * Get Logged In User Favorites
     * @param acceptLanguage
     * @returns UserRatings_UserRatingSummary_ Successful Response
     * @throws ApiError
     */
    public static getLoggedInUserFavoritesApiUsersSelfFavoritesGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<UserRatings_UserRatingSummary_> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/users/self/favorites',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Password
     * Resets the User Password
     * @param requestBody
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static updatePasswordApiUsersPasswordPut(
        requestBody: ChangePassword,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/users/password',
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
     * Update User
     * @param itemId
     * @param requestBody
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static updateUserApiUsersItemIdPut(
        itemId: string,
        requestBody: mealie__schema__user__user__UserBase,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/users/{item_id}',
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
}

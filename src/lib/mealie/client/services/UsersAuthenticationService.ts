/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Body_get_token_api_auth_token_post } from '../models/Body_get_token_api_auth_token_post';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class UsersAuthenticationService {
    /**
     * Get Token
     * @param formData
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getTokenApiAuthTokenPost(
        formData?: Body_get_token_api_auth_token_post,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/auth/token',
            formData: formData,
            mediaType: 'application/x-www-form-urlencoded',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Oauth Login
     * @returns any Successful Response
     * @throws ApiError
     */
    public static oauthLoginApiAuthOauthGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/auth/oauth',
        });
    }
    /**
     * Oauth Callback
     * @returns any Successful Response
     * @throws ApiError
     */
    public static oauthCallbackApiAuthOauthCallbackGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/auth/oauth/callback',
        });
    }
    /**
     * Refresh Token
     * Use a valid token to get another token
     * @returns any Successful Response
     * @throws ApiError
     */
    public static refreshTokenApiAuthRefreshGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/auth/refresh',
        });
    }
    /**
     * Logout
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static logoutApiAuthLogoutPost(
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/auth/logout',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}

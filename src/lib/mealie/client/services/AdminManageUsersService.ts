/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ForgotPassword } from '../models/ForgotPassword';
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { PasswordResetToken } from '../models/PasswordResetToken';
import type { UnlockResults } from '../models/UnlockResults';
import type { UserIn } from '../models/UserIn';
import type { UserOut } from '../models/UserOut';
import type { UserPagination } from '../models/UserPagination';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AdminManageUsersService {
    /**
     * Get All
     * @param orderBy
     * @param orderByNullPosition
     * @param orderDirection
     * @param queryFilter
     * @param paginationSeed
     * @param page
     * @param perPage
     * @param acceptLanguage
     * @returns UserPagination Successful Response
     * @throws ApiError
     */
    public static getAllApiAdminUsersGet(
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<UserPagination> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/admin/users',
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
     * Create One
     * @param requestBody
     * @param acceptLanguage
     * @returns UserOut Successful Response
     * @throws ApiError
     */
    public static createOneApiAdminUsersPost(
        requestBody: UserIn,
        acceptLanguage?: (string | null),
    ): CancelablePromise<UserOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/admin/users',
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
     * Unlock Users
     * @param force
     * @param acceptLanguage
     * @returns UnlockResults Successful Response
     * @throws ApiError
     */
    public static unlockUsersApiAdminUsersUnlockPost(
        force: boolean = false,
        acceptLanguage?: (string | null),
    ): CancelablePromise<UnlockResults> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/admin/users/unlock',
            headers: {
                'accept-language': acceptLanguage,
            },
            query: {
                'force': force,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get One
     * @param itemId
     * @param acceptLanguage
     * @returns UserOut Successful Response
     * @throws ApiError
     */
    public static getOneApiAdminUsersItemIdGet(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<UserOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/admin/users/{item_id}',
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
     * @returns UserOut Successful Response
     * @throws ApiError
     */
    public static updateOneApiAdminUsersItemIdPut(
        itemId: string,
        requestBody: UserOut,
        acceptLanguage?: (string | null),
    ): CancelablePromise<UserOut> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/admin/users/{item_id}',
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
     * @returns UserOut Successful Response
     * @throws ApiError
     */
    public static deleteOneApiAdminUsersItemIdDelete(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<UserOut> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/admin/users/{item_id}',
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
     * Generate Token
     * Generates a reset token and returns it. This is an authenticated endpoint
     * @param requestBody
     * @param acceptLanguage
     * @returns PasswordResetToken Successful Response
     * @throws ApiError
     */
    public static generateTokenApiAdminUsersPasswordResetTokenPost(
        requestBody: ForgotPassword,
        acceptLanguage?: (string | null),
    ): CancelablePromise<PasswordResetToken> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/admin/users/password-reset-token',
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

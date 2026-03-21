/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DeleteTokenResponse } from '../models/DeleteTokenResponse';
import type { LongLiveTokenCreateResponse } from '../models/LongLiveTokenCreateResponse';
import type { LongLiveTokenIn } from '../models/LongLiveTokenIn';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class UsersTokensService {
    /**
     * Create Api Token
     * Create api_token in the Database
     * @param requestBody
     * @param acceptLanguage
     * @returns LongLiveTokenCreateResponse Successful Response
     * @throws ApiError
     */
    public static createApiTokenApiUsersApiTokensPost(
        requestBody: LongLiveTokenIn,
        acceptLanguage?: (string | null),
    ): CancelablePromise<LongLiveTokenCreateResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/users/api-tokens',
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
     * Delete Api Token
     * Delete api_token from the Database
     * @param tokenId
     * @param acceptLanguage
     * @returns DeleteTokenResponse Successful Response
     * @throws ApiError
     */
    public static deleteApiTokenApiUsersApiTokensTokenIdDelete(
        tokenId: number,
        acceptLanguage?: (string | null),
    ): CancelablePromise<DeleteTokenResponse> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/users/api-tokens/{token_id}',
            path: {
                'token_id': tokenId,
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

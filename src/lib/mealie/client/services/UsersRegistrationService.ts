/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateUserRegistration } from '../models/CreateUserRegistration';
import type { UserOut } from '../models/UserOut';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class UsersRegistrationService {
    /**
     * Register New User
     * @param requestBody
     * @param acceptLanguage
     * @returns UserOut Successful Response
     * @throws ApiError
     */
    public static registerNewUserApiUsersRegisterPost(
        requestBody: CreateUserRegistration,
        acceptLanguage?: (string | null),
    ): CancelablePromise<UserOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/users/register',
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

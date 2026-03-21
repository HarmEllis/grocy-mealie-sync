/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EmailReady } from '../models/EmailReady';
import type { EmailSuccess } from '../models/EmailSuccess';
import type { EmailTest } from '../models/EmailTest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AdminEmailService {
    /**
     * Check Email Config
     * Get general application information
     * @param acceptLanguage
     * @returns EmailReady Successful Response
     * @throws ApiError
     */
    public static checkEmailConfigApiAdminEmailGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<EmailReady> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/admin/email',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Send Test Email
     * @param requestBody
     * @param acceptLanguage
     * @returns EmailSuccess Successful Response
     * @throws ApiError
     */
    public static sendTestEmailApiAdminEmailPost(
        requestBody: EmailTest,
        acceptLanguage?: (string | null),
    ): CancelablePromise<EmailSuccess> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/admin/email',
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

/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Body_debug_openai_api_admin_debug_openai_post } from '../models/Body_debug_openai_api_admin_debug_openai_post';
import type { DebugResponse } from '../models/DebugResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AdminDebugService {
    /**
     * Debug Openai
     * @param acceptLanguage
     * @param formData
     * @returns DebugResponse Successful Response
     * @throws ApiError
     */
    public static debugOpenaiApiAdminDebugOpenaiPost(
        acceptLanguage?: (string | null),
        formData?: Body_debug_openai_api_admin_debug_openai_post,
    ): CancelablePromise<DebugResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/admin/debug/openai',
            headers: {
                'accept-language': acceptLanguage,
            },
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}

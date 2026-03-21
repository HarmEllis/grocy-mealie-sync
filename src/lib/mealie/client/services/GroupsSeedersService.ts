/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SeederConfig } from '../models/SeederConfig';
import type { SuccessResponse } from '../models/SuccessResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class GroupsSeedersService {
    /**
     * Seed Foods
     * @param requestBody
     * @param acceptLanguage
     * @returns SuccessResponse Successful Response
     * @throws ApiError
     */
    public static seedFoodsApiGroupsSeedersFoodsPost(
        requestBody: SeederConfig,
        acceptLanguage?: (string | null),
    ): CancelablePromise<SuccessResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/groups/seeders/foods',
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
     * Seed Labels
     * @param requestBody
     * @param acceptLanguage
     * @returns SuccessResponse Successful Response
     * @throws ApiError
     */
    public static seedLabelsApiGroupsSeedersLabelsPost(
        requestBody: SeederConfig,
        acceptLanguage?: (string | null),
    ): CancelablePromise<SuccessResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/groups/seeders/labels',
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
     * Seed Units
     * @param requestBody
     * @param acceptLanguage
     * @returns SuccessResponse Successful Response
     * @throws ApiError
     */
    public static seedUnitsApiGroupsSeedersUnitsPost(
        requestBody: SeederConfig,
        acceptLanguage?: (string | null),
    ): CancelablePromise<SuccessResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/groups/seeders/units',
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

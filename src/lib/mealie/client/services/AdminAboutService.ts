/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AdminAboutInfo } from '../models/AdminAboutInfo';
import type { AppStatistics } from '../models/AppStatistics';
import type { CheckAppConfig } from '../models/CheckAppConfig';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AdminAboutService {
    /**
     * Get App Info
     * Get general application information
     * @param acceptLanguage
     * @returns AdminAboutInfo Successful Response
     * @throws ApiError
     */
    public static getAppInfoApiAdminAboutGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<AdminAboutInfo> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/admin/about',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get App Statistics
     * @param acceptLanguage
     * @returns AppStatistics Successful Response
     * @throws ApiError
     */
    public static getAppStatisticsApiAdminAboutStatisticsGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<AppStatistics> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/admin/about/statistics',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Check App Config
     * @param acceptLanguage
     * @returns CheckAppConfig Successful Response
     * @throws ApiError
     */
    public static checkAppConfigApiAdminAboutCheckGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<CheckAppConfig> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/admin/about/check',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}

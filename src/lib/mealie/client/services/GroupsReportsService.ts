/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ReportCategory } from '../models/ReportCategory';
import type { ReportOut } from '../models/ReportOut';
import type { ReportSummary } from '../models/ReportSummary';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class GroupsReportsService {
    /**
     * Get All
     * @param reportType
     * @param acceptLanguage
     * @returns ReportSummary Successful Response
     * @throws ApiError
     */
    public static getAllApiGroupsReportsGet(
        reportType?: (ReportCategory | null),
        acceptLanguage?: (string | null),
    ): CancelablePromise<Array<ReportSummary>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/groups/reports',
            headers: {
                'accept-language': acceptLanguage,
            },
            query: {
                'report_type': reportType,
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
     * @returns ReportOut Successful Response
     * @throws ApiError
     */
    public static getOneApiGroupsReportsItemIdGet(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ReportOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/groups/reports/{item_id}',
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
     * Delete One
     * @param itemId
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static deleteOneApiGroupsReportsItemIdDelete(
        itemId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/groups/reports/{item_id}',
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
}

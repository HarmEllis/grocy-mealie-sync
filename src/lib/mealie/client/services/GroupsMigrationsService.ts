/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Body_start_data_migration_api_groups_migrations_post } from '../models/Body_start_data_migration_api_groups_migrations_post';
import type { ReportSummary } from '../models/ReportSummary';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class GroupsMigrationsService {
    /**
     * Start Data Migration
     * @param formData
     * @param acceptLanguage
     * @returns ReportSummary Successful Response
     * @throws ApiError
     */
    public static startDataMigrationApiGroupsMigrationsPost(
        formData: Body_start_data_migration_api_groups_migrations_post,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ReportSummary> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/groups/migrations',
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

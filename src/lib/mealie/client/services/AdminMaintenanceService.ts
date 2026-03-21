/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MaintenanceStorageDetails } from '../models/MaintenanceStorageDetails';
import type { MaintenanceSummary } from '../models/MaintenanceSummary';
import type { SuccessResponse } from '../models/SuccessResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AdminMaintenanceService {
    /**
     * Get Maintenance Summary
     * Get the maintenance summary
     * @param acceptLanguage
     * @returns MaintenanceSummary Successful Response
     * @throws ApiError
     */
    public static getMaintenanceSummaryApiAdminMaintenanceGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<MaintenanceSummary> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/admin/maintenance',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Storage Details
     * @param acceptLanguage
     * @returns MaintenanceStorageDetails Successful Response
     * @throws ApiError
     */
    public static getStorageDetailsApiAdminMaintenanceStorageGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<MaintenanceStorageDetails> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/admin/maintenance/storage',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Clean Images
     * Purges all the images from the filesystem that aren't .webp
     * @param acceptLanguage
     * @returns SuccessResponse Successful Response
     * @throws ApiError
     */
    public static cleanImagesApiAdminMaintenanceCleanImagesPost(
        acceptLanguage?: (string | null),
    ): CancelablePromise<SuccessResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/admin/maintenance/clean/images',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Clean Temp
     * @param acceptLanguage
     * @returns SuccessResponse Successful Response
     * @throws ApiError
     */
    public static cleanTempApiAdminMaintenanceCleanTempPost(
        acceptLanguage?: (string | null),
    ): CancelablePromise<SuccessResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/admin/maintenance/clean/temp',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Clean Recipe Folders
     * Deletes all the recipe folders that don't have names that are valid UUIDs
     * @param acceptLanguage
     * @returns SuccessResponse Successful Response
     * @throws ApiError
     */
    public static cleanRecipeFoldersApiAdminMaintenanceCleanRecipeFoldersPost(
        acceptLanguage?: (string | null),
    ): CancelablePromise<SuccessResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/admin/maintenance/clean/recipe-folders',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}

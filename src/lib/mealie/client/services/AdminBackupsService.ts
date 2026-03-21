/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AllBackups } from '../models/AllBackups';
import type { Body_upload_one_api_admin_backups_upload_post } from '../models/Body_upload_one_api_admin_backups_upload_post';
import type { FileTokenResponse } from '../models/FileTokenResponse';
import type { SuccessResponse } from '../models/SuccessResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AdminBackupsService {
    /**
     * Get All
     * @param acceptLanguage
     * @returns AllBackups Successful Response
     * @throws ApiError
     */
    public static getAllApiAdminBackupsGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<AllBackups> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/admin/backups',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create One
     * @param acceptLanguage
     * @returns SuccessResponse Successful Response
     * @throws ApiError
     */
    public static createOneApiAdminBackupsPost(
        acceptLanguage?: (string | null),
    ): CancelablePromise<SuccessResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/admin/backups',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get One
     * Returns a token to download a file
     * @param fileName
     * @param acceptLanguage
     * @returns FileTokenResponse Successful Response
     * @throws ApiError
     */
    public static getOneApiAdminBackupsFileNameGet(
        fileName: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<FileTokenResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/admin/backups/{file_name}',
            path: {
                'file_name': fileName,
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
     * @param fileName
     * @param acceptLanguage
     * @returns SuccessResponse Successful Response
     * @throws ApiError
     */
    public static deleteOneApiAdminBackupsFileNameDelete(
        fileName: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<SuccessResponse> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/admin/backups/{file_name}',
            path: {
                'file_name': fileName,
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
     * Upload One
     * Upload a .zip File to later be imported into Mealie
     * @param formData
     * @param acceptLanguage
     * @returns SuccessResponse Successful Response
     * @throws ApiError
     */
    public static uploadOneApiAdminBackupsUploadPost(
        formData: Body_upload_one_api_admin_backups_upload_post,
        acceptLanguage?: (string | null),
    ): CancelablePromise<SuccessResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/admin/backups/upload',
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
    /**
     * Import One
     * @param fileName
     * @param acceptLanguage
     * @returns SuccessResponse Successful Response
     * @throws ApiError
     */
    public static importOneApiAdminBackupsFileNameRestorePost(
        fileName: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<SuccessResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/admin/backups/{file_name}/restore',
            path: {
                'file_name': fileName,
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

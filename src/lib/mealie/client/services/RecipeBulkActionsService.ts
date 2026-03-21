/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AssignCategories } from '../models/AssignCategories';
import type { AssignSettings } from '../models/AssignSettings';
import type { AssignTags } from '../models/AssignTags';
import type { DeleteRecipes } from '../models/DeleteRecipes';
import type { ExportRecipes } from '../models/ExportRecipes';
import type { GroupDataExport } from '../models/GroupDataExport';
import type { SuccessResponse } from '../models/SuccessResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class RecipeBulkActionsService {
    /**
     * Bulk Tag Recipes
     * @param requestBody
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static bulkTagRecipesApiRecipesBulkActionsTagPost(
        requestBody: AssignTags,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/recipes/bulk-actions/tag',
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
     * Bulk Settings Recipes
     * @param requestBody
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static bulkSettingsRecipesApiRecipesBulkActionsSettingsPost(
        requestBody: AssignSettings,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/recipes/bulk-actions/settings',
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
     * Bulk Categorize Recipes
     * @param requestBody
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static bulkCategorizeRecipesApiRecipesBulkActionsCategorizePost(
        requestBody: AssignCategories,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/recipes/bulk-actions/categorize',
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
     * Bulk Delete Recipes
     * @param requestBody
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static bulkDeleteRecipesApiRecipesBulkActionsDeletePost(
        requestBody: DeleteRecipes,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/recipes/bulk-actions/delete',
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
     * Bulk Export Recipes
     * @param requestBody
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static bulkExportRecipesApiRecipesBulkActionsExportPost(
        requestBody: ExportRecipes,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/recipes/bulk-actions/export',
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
     * Get Exported Data
     * @param acceptLanguage
     * @returns GroupDataExport Successful Response
     * @throws ApiError
     */
    public static getExportedDataApiRecipesBulkActionsExportGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<Array<GroupDataExport>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/recipes/bulk-actions/export',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Exported Data Token
     * Returns a token to download a file
     * @param exportId
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getExportedDataTokenApiRecipesBulkActionsExportExportIdDownloadGet(
        exportId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/recipes/bulk-actions/export/{export_id}/download',
            path: {
                'export_id': exportId,
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
     * Purge Export Data
     * Remove all exports data, including items on disk without database entry
     * @param acceptLanguage
     * @returns SuccessResponse Successful Response
     * @throws ApiError
     */
    public static purgeExportDataApiRecipesBulkActionsExportPurgeDelete(
        acceptLanguage?: (string | null),
    ): CancelablePromise<SuccessResponse> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/recipes/bulk-actions/export/purge',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}

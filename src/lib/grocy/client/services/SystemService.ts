/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DbChangedTimeResponse } from '../models/DbChangedTimeResponse';
import type { MissingLocalizationRequest } from '../models/MissingLocalizationRequest';
import type { TimeResponse } from '../models/TimeResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class SystemService {
    /**
     * Returns information about the installed Grocy version, PHP runtime and OS
     * @returns any An DbChangedTimeResponse object
     * @throws ApiError
     */
    public static getSystemInfo(): CancelablePromise<{
        grocy_version?: {
            Version?: string;
            ReleaseDate?: string;
        };
        php_version?: string;
        sqlite_version?: string;
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/system/info',
        });
    }
    /**
     * Returns the time when the database was last changed
     * @returns DbChangedTimeResponse An DbChangedTimeResponse object
     * @throws ApiError
     */
    public static getSystemDbChangedTime(): CancelablePromise<DbChangedTimeResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/system/db-changed-time',
        });
    }
    /**
     * Returns all config settings
     * @returns any Key/value pairs of config settings
     * @throws ApiError
     */
    public static getSystemConfig(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/system/config',
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
    /**
     * Returns the current server time
     * @param offset Offset of timestamp in seconds. Can be positive or negative.
     * @returns TimeResponse A TimeResponse object
     * @throws ApiError
     */
    public static getSystemTime(
        offset?: number,
    ): CancelablePromise<TimeResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/system/time',
            query: {
                'offset': offset,
            },
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
    /**
     * Returns all localization strings (in the by the user desired language)
     * @returns any The operation was successful
     * @throws ApiError
     */
    public static getSystemLocalizationStrings(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/system/localization-strings',
        });
    }
    /**
     * Logs a missing localization string
     * Only when MODE == 'dev', so should only be called then
     * @param requestBody A valid MissingLocalizationRequest object
     * @returns void
     * @throws ApiError
     */
    public static postSystemLogMissingLocalization(
        requestBody: MissingLocalizationRequest,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/system/log-missing-localization',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
}

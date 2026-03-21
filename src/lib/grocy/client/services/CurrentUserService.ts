/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserSetting } from '../models/UserSetting';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class CurrentUserService {
    /**
     * Returns the currently authenticated user
     * @returns any A user object
     * @throws ApiError
     */
    public static getUser(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/user',
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
    /**
     * Returns all settings of the currently logged in user
     * @returns any Key/value pairs of user settings
     * @throws ApiError
     */
    public static getUserSettings(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/user/settings',
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
    /**
     * Returns the given setting of the currently logged in user
     * @param settingKey The key of the user setting
     * @returns UserSetting A UserSetting object
     * @throws ApiError
     */
    public static getUserSettings1(
        settingKey: string,
    ): CancelablePromise<UserSetting> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/user/settings/{settingKey}',
            path: {
                'settingKey': settingKey,
            },
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
    /**
     * Sets the given setting of the currently logged in user
     * @param settingKey The key of the user setting
     * @param requestBody A valid UserSetting object
     * @returns void
     * @throws ApiError
     */
    public static putUserSettings(
        settingKey: string,
        requestBody: UserSetting,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/user/settings/{settingKey}',
            path: {
                'settingKey': settingKey,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
    /**
     * Deletes the given setting of the currently logged in user
     * @param settingKey The key of the user setting
     * @returns void
     * @throws ApiError
     */
    public static deleteUserSettings(
        settingKey: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/user/settings/{settingKey}',
            path: {
                'settingKey': settingKey,
            },
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
}

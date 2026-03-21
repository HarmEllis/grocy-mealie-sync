/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AppInfo } from '../models/AppInfo';
import type { AppStartupInfo } from '../models/AppStartupInfo';
import type { AppTheme } from '../models/AppTheme';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AppAboutService {
    /**
     * Get App Info
     * Get general application information
     * @returns AppInfo Successful Response
     * @throws ApiError
     */
    public static getAppInfoApiAppAboutGet(): CancelablePromise<AppInfo> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/app/about',
        });
    }
    /**
     * Get Startup Info
     * returns helpful startup information
     * @returns AppStartupInfo Successful Response
     * @throws ApiError
     */
    public static getStartupInfoApiAppAboutStartupInfoGet(): CancelablePromise<AppStartupInfo> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/app/about/startup-info',
        });
    }
    /**
     * Get App Theme
     * Get's the current theme settings
     * @returns AppTheme Successful Response
     * @throws ApiError
     */
    public static getAppThemeApiAppAboutThemeGet(): CancelablePromise<AppTheme> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/app/about/theme',
        });
    }
}

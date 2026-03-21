/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class CalendarService {
    /**
     * Returns the calendar in iCal format
     * @returns string The iCal file contents
     * @throws ApiError
     */
    public static getCalendarIcal(): CancelablePromise<string> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/calendar/ical',
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
    /**
     * Returns a (public) sharing link for the calendar in iCal format
     * @returns any The (public) sharing link for the calendar in iCal format
     * @throws ApiError
     */
    public static getCalendarIcalSharingLink(): CancelablePromise<{
        url?: string;
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/calendar/ical/sharing-link',
        });
    }
}

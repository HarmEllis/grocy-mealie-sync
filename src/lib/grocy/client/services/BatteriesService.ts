/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BatteryChargeCycleEntry } from '../models/BatteryChargeCycleEntry';
import type { BatteryDetailsResponse } from '../models/BatteryDetailsResponse';
import type { CurrentBatteryResponse } from '../models/CurrentBatteryResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class BatteriesService {
    /**
     * Returns all batteries incl. the next estimated charge time per battery
     * @param queryArray An array of filter conditions, each of them is a string in the form of `<field><condition><value>` where<br>`<field>` is a valid field name<br>`<condition>` is a comparison operator, one of<br>&nbsp;&nbsp;`=` equal<br>&nbsp;&nbsp;`!=` not equal<br>&nbsp;&nbsp;`~` LIKE<br>&nbsp;&nbsp;`!~` not LIKE<br>&nbsp;&nbsp;`<` less<br>&nbsp;&nbsp;`>` greater<br>&nbsp;&nbsp;`<=` less or equal<br>&nbsp;&nbsp;`>=` greater or equal<br>&nbsp;&nbsp;`§` regular expression<br>`<value>` is the value to search for
     * @param order A valid field name by which the response should be ordered, use the separator `:` to specify the sort order (`asc` or `desc`, defaults to `asc` when omitted)
     * @param limit The maximum number of objects to return
     * @param offset The number of objects to skip
     * @returns CurrentBatteryResponse An array of CurrentBatteryResponse objects
     * @throws ApiError
     */
    public static getBatteries(
        queryArray?: Array<string>,
        order?: string,
        limit?: number,
        offset?: number,
    ): CancelablePromise<Array<CurrentBatteryResponse>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/batteries',
            query: {
                'query[]': queryArray,
                'order': order,
                'limit': limit,
                'offset': offset,
            },
            errors: {
                500: `The operation was not successful (possible errors are invalid field names or conditions in filter parameters provided)`,
            },
        });
    }
    /**
     * Returns details of the given battery
     * @param batteryId A valid battery id
     * @returns BatteryDetailsResponse A BatteryDetailsResponse object
     * @throws ApiError
     */
    public static getBatteries1(
        batteryId: number,
    ): CancelablePromise<BatteryDetailsResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/batteries/{batteryId}',
            path: {
                'batteryId': batteryId,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Not existing battery)`,
            },
        });
    }
    /**
     * Tracks a charge cycle of the given battery
     * @param batteryId A valid battery id
     * @param requestBody
     * @returns BatteryChargeCycleEntry The operation was successful
     * @throws ApiError
     */
    public static postBatteriesCharge(
        batteryId: number,
        requestBody: {
            /**
             * The time of when the battery was charged, when omitted, the current time is used
             */
            tracked_time?: string;
        },
    ): CancelablePromise<BatteryChargeCycleEntry> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/batteries/{batteryId}/charge',
            path: {
                'batteryId': batteryId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful (possible errors are: Not existing battery)`,
            },
        });
    }
    /**
     * Undoes a battery charge cycle
     * @param chargeCycleId A valid charge cycle id
     * @returns void
     * @throws ApiError
     */
    public static postBatteriesChargeCyclesUndo(
        chargeCycleId: number,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/batteries/charge-cycles/{chargeCycleId}/undo',
            path: {
                'chargeCycleId': chargeCycleId,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Not existing booking)`,
            },
        });
    }
    /**
     * Prints the Grocycode label of the given battery on the configured label printer
     * @param batteryId A valid battery id
     * @returns any The operation was successful
     * @throws ApiError
     */
    public static getBatteriesPrintlabel(
        batteryId: number,
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/batteries/{batteryId}/printlabel',
            path: {
                'batteryId': batteryId,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Not existing battery, error on WebHook execution)`,
            },
        });
    }
}

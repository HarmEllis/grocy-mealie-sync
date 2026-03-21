/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChoreDetailsResponse } from '../models/ChoreDetailsResponse';
import type { ChoreLogEntry } from '../models/ChoreLogEntry';
import type { CurrentChoreResponse } from '../models/CurrentChoreResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ChoresService {
    /**
     * Returns all chores incl. the next estimated execution time per chore
     * @param queryArray An array of filter conditions, each of them is a string in the form of `<field><condition><value>` where<br>`<field>` is a valid field name<br>`<condition>` is a comparison operator, one of<br>&nbsp;&nbsp;`=` equal<br>&nbsp;&nbsp;`!=` not equal<br>&nbsp;&nbsp;`~` LIKE<br>&nbsp;&nbsp;`!~` not LIKE<br>&nbsp;&nbsp;`<` less<br>&nbsp;&nbsp;`>` greater<br>&nbsp;&nbsp;`<=` less or equal<br>&nbsp;&nbsp;`>=` greater or equal<br>&nbsp;&nbsp;`§` regular expression<br>`<value>` is the value to search for
     * @param order A valid field name by which the response should be ordered, use the separator `:` to specify the sort order (`asc` or `desc`, defaults to `asc` when omitted)
     * @param limit The maximum number of objects to return
     * @param offset The number of objects to skip
     * @returns CurrentChoreResponse An array of CurrentChoreResponse objects
     * @throws ApiError
     */
    public static getChores(
        queryArray?: Array<string>,
        order?: string,
        limit?: number,
        offset?: number,
    ): CancelablePromise<Array<CurrentChoreResponse>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/chores',
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
     * Returns details of the given chore
     * @param choreId A valid chore id
     * @returns ChoreDetailsResponse A ChoreDetailsResponse object
     * @throws ApiError
     */
    public static getChores1(
        choreId: number,
    ): CancelablePromise<ChoreDetailsResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/chores/{choreId}',
            path: {
                'choreId': choreId,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Not existing chore)`,
            },
        });
    }
    /**
     * Tracks an execution of the given chore
     * @param choreId A valid chore id
     * @param requestBody
     * @returns ChoreLogEntry The operation was successful
     * @throws ApiError
     */
    public static postChoresExecute(
        choreId: number,
        requestBody: {
            /**
             * The time of when the chore was executed, when omitted, the current time is used
             */
            tracked_time?: string;
            /**
             * A valid user id of who executed this chore, when omitted, the currently authenticated user will be used
             */
            done_by?: number;
            /**
             * `true` when the execution should be tracked as skipped, defaults to `false` when omitted
             */
            skipped?: boolean;
        },
    ): CancelablePromise<ChoreLogEntry> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/chores/{choreId}/execute',
            path: {
                'choreId': choreId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful (possible errors are: Not existing chore)`,
            },
        });
    }
    /**
     * Undoes a chore execution
     * @param executionId A valid chore execution id
     * @returns void
     * @throws ApiError
     */
    public static postChoresExecutionsUndo(
        executionId: number,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/chores/executions/{executionId}/undo',
            path: {
                'executionId': executionId,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Not existing booking)`,
            },
        });
    }
    /**
     * (Re)calculates all next user assignments of all chores
     * @param requestBody
     * @returns void
     * @throws ApiError
     */
    public static postChoresExecutionsCalculateNextAssignments(
        requestBody?: {
            /**
             * The chore id of the chore which next user assignment should be (re)calculated, when omitted, the next user assignments of all chores will (re)caluclated
             */
            chore_id?: number;
        },
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/chores/executions/calculate-next-assignments',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
    /**
     * Prints the Grocycode label of the given chore on the configured label printer
     * @param choreId A valid chore id
     * @returns any The operation was successful
     * @throws ApiError
     */
    public static getChoresPrintlabel(
        choreId: number,
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/chores/{choreId}/printlabel',
            path: {
                'choreId': choreId,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Not existing chore, error on WebHook execution)`,
            },
        });
    }
    /**
     * Merges two chores into one
     * @param choreIdToKeep A valid chore id of the chore to keep
     * @param choreIdToRemove A valid chore id of the chore to remove
     * @returns void
     * @throws ApiError
     */
    public static postChoresMerge(
        choreIdToKeep: number,
        choreIdToRemove: number,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/chores/{choreIdToKeep}/merge/{choreIdToRemove}',
            path: {
                'choreIdToKeep': choreIdToKeep,
                'choreIdToRemove': choreIdToRemove,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Invalid chore id)`,
            },
        });
    }
}

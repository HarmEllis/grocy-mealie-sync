/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CurrentTaskResponse } from '../models/CurrentTaskResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class TasksService {
    /**
     * Returns all tasks which are not done yet
     * @param queryArray An array of filter conditions, each of them is a string in the form of `<field><condition><value>` where<br>`<field>` is a valid field name<br>`<condition>` is a comparison operator, one of<br>&nbsp;&nbsp;`=` equal<br>&nbsp;&nbsp;`!=` not equal<br>&nbsp;&nbsp;`~` LIKE<br>&nbsp;&nbsp;`!~` not LIKE<br>&nbsp;&nbsp;`<` less<br>&nbsp;&nbsp;`>` greater<br>&nbsp;&nbsp;`<=` less or equal<br>&nbsp;&nbsp;`>=` greater or equal<br>&nbsp;&nbsp;`§` regular expression<br>`<value>` is the value to search for
     * @param order A valid field name by which the response should be ordered, use the separator `:` to specify the sort order (`asc` or `desc`, defaults to `asc` when omitted)
     * @param limit The maximum number of objects to return
     * @param offset The number of objects to skip
     * @returns CurrentTaskResponse An array of CurrentTaskResponse objects
     * @throws ApiError
     */
    public static getTasks(
        queryArray?: Array<string>,
        order?: string,
        limit?: number,
        offset?: number,
    ): CancelablePromise<Array<CurrentTaskResponse>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/tasks',
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
     * Marks the given task as completed
     * @param taskId A valid task id
     * @param requestBody
     * @returns void
     * @throws ApiError
     */
    public static postTasksComplete(
        taskId: number,
        requestBody: {
            /**
             * The time of when the task was completed, when omitted, the current time is used
             */
            done_time?: string;
        },
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/tasks/{taskId}/complete',
            path: {
                'taskId': taskId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful (possible errors are: Not existing task)`,
            },
        });
    }
    /**
     * Marks the given task as not completed
     * @param taskId A valid task id
     * @returns void
     * @throws ApiError
     */
    public static postTasksUndo(
        taskId: number,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/tasks/{taskId}/undo',
            path: {
                'taskId': taskId,
            },
            errors: {
                400: `The operation was not successful (possible errors are: Not existing task)`,
            },
        });
    }
}

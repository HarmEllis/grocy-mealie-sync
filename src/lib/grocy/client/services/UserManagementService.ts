/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { User } from '../models/User';
import type { UserDto } from '../models/UserDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class UserManagementService {
    /**
     * Returns all users
     * @param queryArray An array of filter conditions, each of them is a string in the form of `<field><condition><value>` where<br>`<field>` is a valid field name<br>`<condition>` is a comparison operator, one of<br>&nbsp;&nbsp;`=` equal<br>&nbsp;&nbsp;`!=` not equal<br>&nbsp;&nbsp;`~` LIKE<br>&nbsp;&nbsp;`!~` not LIKE<br>&nbsp;&nbsp;`<` less<br>&nbsp;&nbsp;`>` greater<br>&nbsp;&nbsp;`<=` less or equal<br>&nbsp;&nbsp;`>=` greater or equal<br>&nbsp;&nbsp;`§` regular expression<br>`<value>` is the value to search for
     * @param order A valid field name by which the response should be ordered, use the separator `:` to specify the sort order (`asc` or `desc`, defaults to `asc` when omitted)
     * @param limit The maximum number of objects to return
     * @param offset The number of objects to skip
     * @returns UserDto A list of user objects
     * @throws ApiError
     */
    public static getUsers(
        queryArray?: Array<string>,
        order?: string,
        limit?: number,
        offset?: number,
    ): CancelablePromise<Array<UserDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/users',
            query: {
                'query[]': queryArray,
                'order': order,
                'limit': limit,
                'offset': offset,
            },
            errors: {
                400: `The operation was not successful`,
                500: `The operation was not successful (possible errors are invalid field names or conditions in filter parameters provided)`,
            },
        });
    }
    /**
     * Creates a new user
     * @param requestBody A valid user object
     * @returns void
     * @throws ApiError
     */
    public static postUsers(
        requestBody: User,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/users',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
    /**
     * Edits the given user
     * @param userId A valid user id
     * @param requestBody A valid user object
     * @returns void
     * @throws ApiError
     */
    public static putUsers(
        userId: number,
        requestBody: User,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/users/{userId}',
            path: {
                'userId': userId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
    /**
     * Deletes the given user
     * @param userId A valid user id
     * @returns void
     * @throws ApiError
     */
    public static deleteUsers(
        userId: number,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/users/{userId}',
            path: {
                'userId': userId,
            },
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
    /**
     * Returns the assigned permissions of the given user
     * See "GET /objects/permission_hierarchy" for a permission name / id mapping
     * @param userId A valid user id
     * @returns any A list of user permission objects
     * @throws ApiError
     */
    public static getUsersPermissions(
        userId: number,
    ): CancelablePromise<Array<{
        permission_id?: number;
        user_id?: number;
    }>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/users/{userId}/permissions',
            path: {
                'userId': userId,
            },
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
    /**
     * Adds a permission to the given user
     * See "GET /objects/permission_hierarchy" for a permission name / id mapping
     * @param userId A valid user id
     * @param requestBody
     * @returns void
     * @throws ApiError
     */
    public static postUsersPermissions(
        userId: number,
        requestBody: {
            /**
             * A permission ids
             */
            permissions_id?: number;
        },
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/users/{userId}/permissions',
            path: {
                'userId': userId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
    /**
     * Replaces the assigned permissions of the given user
     * See "GET /objects/permission_hierarchy" for a permission name / id mapping
     * @param userId A valid user id
     * @param requestBody
     * @returns void
     * @throws ApiError
     */
    public static putUsersPermissions(
        userId: number,
        requestBody: {
            /**
             * A list of permission ids
             */
            permissions?: Array<number>;
        },
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/users/{userId}/permissions',
            path: {
                'userId': userId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
}

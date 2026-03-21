/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GroupStorage } from '../models/GroupStorage';
import type { GroupSummary } from '../models/GroupSummary';
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { PaginationBase_UserSummary_ } from '../models/PaginationBase_UserSummary_';
import type { ReadGroupPreferences } from '../models/ReadGroupPreferences';
import type { UpdateGroupPreferences } from '../models/UpdateGroupPreferences';
import type { UserSummary } from '../models/UserSummary';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class GroupsSelfServiceService {
    /**
     * Get Logged In User Group
     * Returns the Group Data for the Current User
     * @param acceptLanguage
     * @returns GroupSummary Successful Response
     * @throws ApiError
     */
    public static getLoggedInUserGroupApiGroupsSelfGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<GroupSummary> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/groups/self',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Group Members
     * Returns all users belonging to the current group
     * @param orderBy
     * @param orderByNullPosition
     * @param orderDirection
     * @param queryFilter
     * @param paginationSeed
     * @param page
     * @param perPage
     * @param acceptLanguage
     * @returns PaginationBase_UserSummary_ Successful Response
     * @throws ApiError
     */
    public static getGroupMembersApiGroupsMembersGet(
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        acceptLanguage?: (string | null),
    ): CancelablePromise<PaginationBase_UserSummary_> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/groups/members',
            headers: {
                'accept-language': acceptLanguage,
            },
            query: {
                'orderBy': orderBy,
                'orderByNullPosition': orderByNullPosition,
                'orderDirection': orderDirection,
                'queryFilter': queryFilter,
                'paginationSeed': paginationSeed,
                'page': page,
                'perPage': perPage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Group Member
     * Returns a single user belonging to the current group
     * @param usernameOrId
     * @param acceptLanguage
     * @returns UserSummary Successful Response
     * @throws ApiError
     */
    public static getGroupMemberApiGroupsMembersUsernameOrIdGet(
        usernameOrId: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<UserSummary> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/groups/members/{username_or_id}',
            path: {
                'username_or_id': usernameOrId,
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
     * Get Group Preferences
     * @param acceptLanguage
     * @returns ReadGroupPreferences Successful Response
     * @throws ApiError
     */
    public static getGroupPreferencesApiGroupsPreferencesGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<ReadGroupPreferences> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/groups/preferences',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Group Preferences
     * @param requestBody
     * @param acceptLanguage
     * @returns ReadGroupPreferences Successful Response
     * @throws ApiError
     */
    public static updateGroupPreferencesApiGroupsPreferencesPut(
        requestBody: UpdateGroupPreferences,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ReadGroupPreferences> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/groups/preferences',
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
     * Get Storage
     * @param acceptLanguage
     * @returns GroupStorage Successful Response
     * @throws ApiError
     */
    public static getStorageApiGroupsStorageGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<GroupStorage> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/groups/storage',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}

/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuthMethod } from './AuthMethod';
import type { LongLiveTokenOut } from './LongLiveTokenOut';
export type UserOut = {
    id: string;
    username?: (string | null);
    fullName?: (string | null);
    email: string;
    authMethod?: AuthMethod;
    admin?: boolean;
    group: string;
    household: string;
    advanced?: boolean;
    canInvite?: boolean;
    canManage?: boolean;
    canManageHousehold?: boolean;
    canOrganize?: boolean;
    groupId: string;
    groupSlug: string;
    householdId: string;
    householdSlug: string;
    tokens?: (Array<LongLiveTokenOut> | null);
    cacheKey: string;
};


/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuthMethod } from './AuthMethod';
export type mealie__schema__user__user__UserBase = {
    id?: (string | null);
    username?: (string | null);
    fullName?: (string | null);
    email: string;
    authMethod?: AuthMethod;
    admin?: boolean;
    group?: (string | null);
    household?: (string | null);
    advanced?: boolean;
    canInvite?: boolean;
    canManage?: boolean;
    canManageHousehold?: boolean;
    canOrganize?: boolean;
};


/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuthMethod } from './AuthMethod';
export type UserIn = {
    id?: (string | null);
    username: string;
    fullName: string;
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
    password: string;
};


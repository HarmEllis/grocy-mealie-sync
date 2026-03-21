/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CookbookHousehold } from './CookbookHousehold';
import type { QueryFilterJSON } from './QueryFilterJSON';
export type ReadCookBook = {
    name: string;
    description?: string;
    slug?: (string | null);
    position?: number;
    public?: boolean;
    queryFilterString?: string;
    groupId: string;
    householdId: string;
    id: string;
    queryFilter?: QueryFilterJSON;
    household?: (CookbookHousehold | null);
};


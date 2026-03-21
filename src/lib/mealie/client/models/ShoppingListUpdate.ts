/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ShoppingListItemOut_Input } from './ShoppingListItemOut_Input';
export type ShoppingListUpdate = {
    name?: (string | null);
    extras?: (Record<string, any> | null);
    createdAt?: (string | null);
    update_at?: (string | null);
    groupId: string;
    userId: string;
    id: string;
    listItems?: Array<ShoppingListItemOut_Input>;
};


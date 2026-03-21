/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ShoppingListSummary } from './ShoppingListSummary';
export type ShoppingListPagination = {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
    items: Array<ShoppingListSummary>;
    next?: (string | null);
    previous?: (string | null);
};


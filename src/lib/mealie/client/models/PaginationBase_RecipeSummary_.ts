/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RecipeSummary } from './RecipeSummary';
export type PaginationBase_RecipeSummary_ = {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
    items: Array<RecipeSummary>;
    next?: (string | null);
    previous?: (string | null);
};


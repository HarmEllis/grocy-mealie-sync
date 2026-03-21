/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RecipeTool } from './RecipeTool';
export type PaginationBase_RecipeTool_ = {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
    items: Array<RecipeTool>;
    next?: (string | null);
    previous?: (string | null);
};


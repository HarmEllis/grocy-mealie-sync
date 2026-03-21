/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RecipeCategory } from './RecipeCategory';
export type PaginationBase_RecipeCategory_ = {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
    items: Array<RecipeCategory>;
    next?: (string | null);
    previous?: (string | null);
};


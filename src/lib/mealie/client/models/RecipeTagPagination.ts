/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RecipeTag } from './RecipeTag';
export type RecipeTagPagination = {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
    items: Array<RecipeTag>;
    next?: (string | null);
    previous?: (string | null);
};


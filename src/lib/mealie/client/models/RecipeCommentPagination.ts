/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RecipeCommentOut_Output } from './RecipeCommentOut_Output';
export type RecipeCommentPagination = {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
    items: Array<RecipeCommentOut_Output>;
    next?: (string | null);
    previous?: (string | null);
};


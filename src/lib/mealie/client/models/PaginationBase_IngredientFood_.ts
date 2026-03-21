/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IngredientFood_Output } from './IngredientFood_Output';
export type PaginationBase_IngredientFood_ = {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
    items: Array<IngredientFood_Output>;
    next?: (string | null);
    previous?: (string | null);
};


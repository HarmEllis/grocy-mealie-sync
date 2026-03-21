/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IngredientUnit_Output } from './IngredientUnit_Output';
export type IngredientUnitPagination = {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
    items: Array<IngredientUnit_Output>;
    next?: (string | null);
    previous?: (string | null);
};


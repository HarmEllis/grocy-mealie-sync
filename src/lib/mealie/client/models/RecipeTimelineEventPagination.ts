/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RecipeTimelineEventOut } from './RecipeTimelineEventOut';
export type RecipeTimelineEventPagination = {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
    items: Array<RecipeTimelineEventOut>;
    next?: (string | null);
    previous?: (string | null);
};


/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ReadPlanEntry } from './ReadPlanEntry';
export type PlanEntryPagination = {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
    items: Array<ReadPlanEntry>;
    next?: (string | null);
    previous?: (string | null);
};


/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { HouseholdSummary } from './HouseholdSummary';
export type PaginationBase_HouseholdSummary_ = {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
    items: Array<HouseholdSummary>;
    next?: (string | null);
    previous?: (string | null);
};


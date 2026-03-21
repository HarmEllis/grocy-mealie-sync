/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { HouseholdInDB } from './HouseholdInDB';
export type HouseholdPagination = {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
    items: Array<HouseholdInDB>;
    next?: (string | null);
    previous?: (string | null);
};


/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GroupInDB } from './GroupInDB';
export type GroupPagination = {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
    items: Array<GroupInDB>;
    next?: (string | null);
    previous?: (string | null);
};


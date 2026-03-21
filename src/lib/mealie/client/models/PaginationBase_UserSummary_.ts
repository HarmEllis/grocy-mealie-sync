/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserSummary } from './UserSummary';
export type PaginationBase_UserSummary_ = {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
    items: Array<UserSummary>;
    next?: (string | null);
    previous?: (string | null);
};


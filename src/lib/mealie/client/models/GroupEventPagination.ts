/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GroupEventNotifierOut } from './GroupEventNotifierOut';
export type GroupEventPagination = {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
    items: Array<GroupEventNotifierOut>;
    next?: (string | null);
    previous?: (string | null);
};


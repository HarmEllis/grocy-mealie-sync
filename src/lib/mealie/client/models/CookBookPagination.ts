/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ReadCookBook } from './ReadCookBook';
export type CookBookPagination = {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
    items: Array<ReadCookBook>;
    next?: (string | null);
    previous?: (string | null);
};


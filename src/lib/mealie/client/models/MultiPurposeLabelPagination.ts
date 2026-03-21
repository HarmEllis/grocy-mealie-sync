/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MultiPurposeLabelSummary } from './MultiPurposeLabelSummary';
export type MultiPurposeLabelPagination = {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
    items: Array<MultiPurposeLabelSummary>;
    next?: (string | null);
    previous?: (string | null);
};


/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ReportCategory } from './ReportCategory';
import type { ReportSummaryStatus } from './ReportSummaryStatus';
export type ReportSummary = {
    timestamp?: string;
    category: ReportCategory;
    groupId: string;
    name: string;
    status?: ReportSummaryStatus;
    id: string;
};


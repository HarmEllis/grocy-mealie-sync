/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PlanRulesOut } from './PlanRulesOut';
export type PlanRulesPagination = {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
    items: Array<PlanRulesOut>;
    next?: (string | null);
    previous?: (string | null);
};


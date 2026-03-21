/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PlanEntryType } from './PlanEntryType';
export type UpdatePlanEntry = {
    date: string;
    entryType?: PlanEntryType;
    title?: string;
    text?: string;
    recipeId?: (string | null);
    id: number;
    groupId: string;
    userId: string;
};


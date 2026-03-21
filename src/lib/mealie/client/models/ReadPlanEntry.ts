/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PlanEntryType } from './PlanEntryType';
import type { RecipeSummary } from './RecipeSummary';
export type ReadPlanEntry = {
    date: string;
    entryType?: PlanEntryType;
    title?: string;
    text?: string;
    recipeId?: (string | null);
    id: number;
    groupId: string;
    userId: string;
    householdId: string;
    recipe?: (RecipeSummary | null);
};


/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CategoryBase } from './CategoryBase';
import type { GroupHouseholdSummary } from './GroupHouseholdSummary';
import type { ReadGroupPreferences } from './ReadGroupPreferences';
import type { ReadWebhook } from './ReadWebhook';
import type { UserSummary } from './UserSummary';
export type GroupInDB = {
    name: string;
    id: string;
    slug: string;
    categories?: (Array<CategoryBase> | null);
    webhooks?: Array<ReadWebhook>;
    households?: (Array<GroupHouseholdSummary> | null);
    users?: (Array<UserSummary> | null);
    preferences?: (ReadGroupPreferences | null);
};


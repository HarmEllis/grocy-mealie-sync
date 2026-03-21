/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { HouseholdUserSummary } from './HouseholdUserSummary';
import type { ReadHouseholdPreferences } from './ReadHouseholdPreferences';
import type { ReadWebhook } from './ReadWebhook';
export type HouseholdInDB = {
    groupId: string;
    name: string;
    id: string;
    slug: string;
    preferences?: (ReadHouseholdPreferences | null);
    group: string;
    users?: (Array<HouseholdUserSummary> | null);
    webhooks?: Array<ReadWebhook>;
};


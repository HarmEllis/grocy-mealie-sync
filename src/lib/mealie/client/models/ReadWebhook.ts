/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { WebhookType } from './WebhookType';
export type ReadWebhook = {
    enabled?: boolean;
    name?: string;
    url?: string;
    webhookType?: WebhookType;
    scheduledTime: string;
    groupId: string;
    householdId: string;
    id: string;
};


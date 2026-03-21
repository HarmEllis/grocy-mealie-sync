/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { WebhookType } from './WebhookType';
export type CreateWebhook = {
    enabled?: boolean;
    name?: string;
    url?: string;
    webhookType?: WebhookType;
    scheduledTime: string;
};


/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ReadWebhook } from './ReadWebhook';
export type WebhookPagination = {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
    items: Array<ReadWebhook>;
    next?: (string | null);
    previous?: (string | null);
};


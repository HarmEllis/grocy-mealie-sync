/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { StockTransactionType } from './StockTransactionType';
export type StockJournal = {
    correlation_id?: string;
    undone?: number;
    undone_timestamp?: string;
    amount?: number;
    location_id?: number;
    location_name?: string;
    product_name?: string;
    qu_name?: string;
    qu_name_plural?: string;
    user_display_name?: string;
    spoiled?: boolean;
    transaction_type?: StockTransactionType;
    row_created_timestamp?: string;
};


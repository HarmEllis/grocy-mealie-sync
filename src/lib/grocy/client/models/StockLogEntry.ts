/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { StockTransactionType } from './StockTransactionType';
export type StockLogEntry = {
    id?: number;
    product_id?: number;
    amount?: number;
    best_before_date?: string;
    purchased_date?: string;
    used_date?: string;
    spoiled?: boolean;
    stock_id?: string;
    transaction_id?: string;
    transaction_type?: StockTransactionType;
    note?: string;
    row_created_timestamp?: string;
};


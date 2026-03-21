/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ProductWithoutUserfields } from './ProductWithoutUserfields';
export type CurrentStockResponse = {
    product_id?: number;
    amount?: number;
    amount_aggregated?: number;
    amount_opened?: number;
    amount_opened_aggregated?: number;
    /**
     * The next due date for this product
     */
    best_before_date?: string;
    /**
     * Indicates wheter this product has sub-products or not / if the fields `amount_aggregated` and `amount_opened_aggregated` are filled
     */
    is_aggregated_amount?: boolean;
    product?: ProductWithoutUserfields;
};


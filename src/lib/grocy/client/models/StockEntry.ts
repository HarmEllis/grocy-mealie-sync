/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type StockEntry = {
    id?: number;
    product_id?: number;
    location_id?: number;
    shopping_location_id?: number;
    amount?: number;
    best_before_date?: string;
    purchased_date?: string;
    /**
     * A unique id which references this stock entry during its lifetime
     */
    stock_id?: string;
    price?: number;
    open?: number;
    opened_date?: string;
    note?: string;
    row_created_timestamp?: string;
};


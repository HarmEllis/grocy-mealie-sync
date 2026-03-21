/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ShoppingListItem = {
    id?: number;
    shopping_list_id?: number;
    product_id?: number;
    note?: string;
    /**
     * The manual entered amount
     */
    amount?: number;
    row_created_timestamp?: string;
    /**
     * Key/value pairs of userfields
     */
    userfields?: Record<string, any>;
};


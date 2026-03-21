/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Product = {
    id?: number;
    name?: string;
    description?: string;
    location_id?: number;
    qu_id_purchase?: number;
    qu_id_stock?: number;
    enable_tare_weight_handling?: number;
    not_check_stock_fulfillment_for_recipes?: number;
    product_group_id?: number;
    tare_weight?: number;
    min_stock_amount?: number;
    default_best_before_days?: number;
    default_best_before_days_after_open?: number;
    picture_file_name?: string;
    row_created_timestamp?: string;
    shopping_location_id?: number;
    treat_opened_as_out_of_stock?: number;
    auto_reprint_stock_label?: number;
    no_own_stock?: number;
    /**
     * Key/value pairs of userfields
     */
    userfields?: Record<string, any>;
    should_not_be_frozen?: number;
    default_consume_location_id?: number;
    move_on_open?: number;
};


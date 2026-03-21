/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Location } from './Location';
import type { Product } from './Product';
import type { ProductBarcode } from './ProductBarcode';
import type { QuantityUnit } from './QuantityUnit';
export type ProductDetailsResponse = {
    product?: Product;
    product_barcodes?: Array<ProductBarcode>;
    quantity_unit_stock?: QuantityUnit;
    default_quantity_unit_purchase?: QuantityUnit;
    default_quantity_unit_consume?: QuantityUnit;
    quantity_unit_price?: QuantityUnit;
    last_purchased?: string;
    last_used?: string;
    stock_amount?: number;
    stock_amount_opened?: number;
    next_due_date?: string;
    /**
     * The price of the last purchase of the corresponding product
     */
    last_price?: number;
    /**
     * The average price af all stock entries currently in stock of the corresponding product
     */
    avg_price?: number;
    /**
     * The current price of the corresponding product, based on the stock entry to use next (defined by the default consume rule "Opened first, then first due first, then first in first out") or on the last price if the product is currently not in stock
     */
    current_price?: number;
    /**
     * This field is deprecated and will be removed in a future version (currently returns the same as `current_price`)
     * @deprecated
     */
    oldest_price?: number;
    last_shopping_location_id?: number;
    location?: Location;
    average_shelf_life_days?: number;
    spoil_rate_percent?: number;
    /**
     * True when the product is a parent product of others
     */
    has_childs?: boolean;
    default_location?: Location;
    /**
     * The conversion factor of the corresponding QU conversion from the product's qu_id_purchase to qu_id_stock
     */
    qu_conversion_factor_purchase_to_stock?: number;
    /**
     * The conversion factor of the corresponding QU conversion from the product's qu_id_price to qu_id_stock
     */
    qu_conversion_factor_price_to_stock?: number;
};


/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ExternalBarcodeLookupResponse = {
    name?: string;
    location_id?: number;
    qu_id_purchase?: number;
    qu_id_stock?: number;
    qu_factor_purchase_to_stock?: number;
    /**
     * Can contain multiple barcodes separated by comma
     */
    barcode?: string;
    /**
     * The id of the added product, only included when the producted was added to the database
     */
    id?: number;
};


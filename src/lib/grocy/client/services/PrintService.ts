/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class PrintService {
    /**
     * Prints the shoppinglist with a thermal printer
     * @param list Shopping list id
     * @param printHeader Prints Grocy logo if true
     * @returns any Returns OK if the printing was successful
     * @throws ApiError
     */
    public static getPrintShoppinglistThermal(
        list: number = 1,
        printHeader: boolean = true,
    ): CancelablePromise<{
        result?: string;
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/print/shoppinglist/thermal',
            query: {
                'list': list,
                'printHeader': printHeader,
            },
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
}

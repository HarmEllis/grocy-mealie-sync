/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CurrentStockResponse } from './CurrentStockResponse';
export type CurrentVolatilStockResponse = {
    due_products?: Array<CurrentStockResponse>;
    overdue_products?: Array<CurrentStockResponse>;
    expired_products?: Array<CurrentStockResponse>;
    missing_products?: Array<any>;
};


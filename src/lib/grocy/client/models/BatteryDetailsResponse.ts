/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Battery } from './Battery';
export type BatteryDetailsResponse = {
    chore?: Battery;
    /**
     * When this battery was last charged
     */
    last_charged?: string;
    /**
     * How often this battery was charged so far
     */
    charge_cycles_count?: number;
    next_estimated_charge_time?: string;
};


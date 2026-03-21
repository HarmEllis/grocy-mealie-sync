/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CurrentBatteryResponse = {
    battery_id?: number;
    last_tracked_time?: string;
    /**
     * The next estimated charge time of this battery, 2999-12-31 23:59:59 when the given battery has no charge_interval_days defined
     */
    next_estimated_charge_time?: string;
};


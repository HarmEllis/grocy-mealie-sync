/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Chore = {
    id?: number;
    name?: string;
    description?: string;
    period_type?: Chore.period_type;
    period_config?: string;
    period_days?: number;
    track_date_only?: boolean;
    rollover?: boolean;
    assignment_type?: Chore.assignment_type;
    assignment_config?: string;
    next_execution_assigned_to_user_id?: number;
    start_date?: string;
    rescheduled_date?: string;
    rescheduled_next_execution_assigned_to_user_id?: number;
    row_created_timestamp?: string;
    /**
     * Key/value pairs of userfields
     */
    userfields?: Record<string, any>;
};
export namespace Chore {
    export enum period_type {
        MANUALLY = 'manually',
        HOURLY = 'hourly',
        DAILY = 'daily',
        WEEKLY = 'weekly',
        MONTHLY = 'monthly',
    }
    export enum assignment_type {
        NO_ASSIGNMENT = 'no-assignment',
        WHO_LEAST_DID_FIRST = 'who-least-did-first',
        RANDOM = 'random',
        IN_ALPHABETICAL_ORDER = 'in-alphabetical-order',
    }
}


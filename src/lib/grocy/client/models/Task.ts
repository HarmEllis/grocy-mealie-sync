/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Task = {
    id?: number;
    name?: string;
    description?: string;
    due_date?: string;
    done?: number;
    done_timestamp?: string;
    category_id?: number;
    assigned_to_user_id?: number;
    row_created_timestamp?: string;
    /**
     * Key/value pairs of userfields
     */
    userfields?: Record<string, any>;
};


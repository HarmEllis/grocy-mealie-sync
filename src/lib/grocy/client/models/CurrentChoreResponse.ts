/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserDto } from './UserDto';
export type CurrentChoreResponse = {
    chore_id?: number;
    chore_name?: string;
    last_tracked_time?: string;
    track_date_only?: boolean;
    /**
     * The next estimated execution time of this chore, 2999-12-31 23:59:59 when the given chore has a period_type of manually
     */
    next_estimated_execution_time?: string;
    next_execution_assigned_to_user_id?: number;
    is_rescheduled?: boolean;
    is_reassigned?: boolean;
    next_execution_assigned_user?: UserDto;
};


/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Chore } from './Chore';
import type { UserDto } from './UserDto';
export type ChoreDetailsResponse = {
    chore?: Chore;
    /**
     * When this chore was last tracked
     */
    last_tracked?: string;
    /**
     * How often this chore was tracked so far
     */
    track_count?: number;
    last_done_by?: UserDto;
    next_estimated_execution_time?: string;
    next_execution_assigned_user?: UserDto;
    /**
     * Contains the average past execution frequency in hours or `null`, when the chore was never executed before
     */
    average_execution_frequency_hours?: number;
};


/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TimelineEventImage } from './TimelineEventImage';
import type { TimelineEventType } from './TimelineEventType';
export type RecipeTimelineEventOut = {
    recipeId: string;
    userId: string;
    subject: string;
    eventType: TimelineEventType;
    eventMessage?: (string | null);
    image?: (TimelineEventImage | null);
    timestamp?: string;
    id: string;
    groupId: string;
    householdId: string;
    createdAt: string;
    updatedAt: string;
};


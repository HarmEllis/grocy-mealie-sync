/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TimelineEventImage } from './TimelineEventImage';
import type { TimelineEventType } from './TimelineEventType';
export type RecipeTimelineEventIn = {
    recipeId: string;
    userId?: (string | null);
    subject: string;
    eventType: TimelineEventType;
    eventMessage?: (string | null);
    image?: (TimelineEventImage | null);
    timestamp?: string;
};


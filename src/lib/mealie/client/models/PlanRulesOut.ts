/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PlanRulesDay } from './PlanRulesDay';
import type { PlanRulesType } from './PlanRulesType';
import type { QueryFilterJSON } from './QueryFilterJSON';
export type PlanRulesOut = {
    day?: PlanRulesDay;
    entryType?: PlanRulesType;
    queryFilterString?: string;
    groupId: string;
    householdId: string;
    id: string;
    queryFilter?: QueryFilterJSON;
};


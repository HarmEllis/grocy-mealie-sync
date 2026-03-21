/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { LogicalOperator } from './LogicalOperator';
import type { RelationalKeyword } from './RelationalKeyword';
import type { RelationalOperator } from './RelationalOperator';
export type QueryFilterJSONPart = {
    leftParenthesis?: (string | null);
    rightParenthesis?: (string | null);
    logicalOperator?: (LogicalOperator | null);
    attributeName?: (string | null);
    relationalOperator?: (RelationalKeyword | RelationalOperator | null);
    value?: (string | Array<string> | null);
};


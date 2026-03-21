/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IngredientFoodAlias } from './IngredientFoodAlias';
import type { MultiPurposeLabelSummary } from './MultiPurposeLabelSummary';
export type IngredientFood_Output = {
    id: string;
    name: string;
    pluralName?: (string | null);
    description?: string;
    extras?: (Record<string, any> | null);
    labelId?: (string | null);
    aliases?: Array<IngredientFoodAlias>;
    householdsWithIngredientFood?: Array<string>;
    label?: (MultiPurposeLabelSummary | null);
    createdAt?: (string | null);
    updatedAt?: (string | null);
};


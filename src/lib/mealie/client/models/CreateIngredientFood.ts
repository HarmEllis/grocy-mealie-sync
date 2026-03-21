/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateIngredientFoodAlias } from './CreateIngredientFoodAlias';
export type CreateIngredientFood = {
    id?: (string | null);
    name: string;
    pluralName?: (string | null);
    description?: string;
    extras?: (Record<string, any> | null);
    labelId?: (string | null);
    aliases?: Array<CreateIngredientFoodAlias>;
    householdsWithIngredientFood?: Array<string>;
};


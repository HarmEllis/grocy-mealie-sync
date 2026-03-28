/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IngredientUnitAlias } from './IngredientUnitAlias';
export type IngredientUnit_Output = {
    id: string;
    name: string;
    pluralName?: (string | null);
    description?: string;
    extras?: (Record<string, any> | null);
    fraction?: boolean;
    abbreviation?: string;
    pluralAbbreviation?: (string | null);
    useAbbreviation?: boolean;
    aliases?: Array<IngredientUnitAlias>;
    standardQuantity?: (number | null);
    standardUnit?: (string | null);
    createdAt?: (string | null);
    updatedAt?: (string | null);
};


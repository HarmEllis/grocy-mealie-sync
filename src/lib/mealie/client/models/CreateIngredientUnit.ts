/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateIngredientUnitAlias } from './CreateIngredientUnitAlias';
export type CreateIngredientUnit = {
    id?: (string | null);
    name: string;
    pluralName?: (string | null);
    description?: string;
    extras?: (Record<string, any> | null);
    fraction?: boolean;
    abbreviation?: string;
    pluralAbbreviation?: (string | null);
    useAbbreviation?: boolean;
    aliases?: Array<CreateIngredientUnitAlias>;
};


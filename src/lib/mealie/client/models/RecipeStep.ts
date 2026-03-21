/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IngredientReferences } from './IngredientReferences';
export type RecipeStep = {
    id?: (string | null);
    title?: (string | null);
    summary?: (string | null);
    text: string;
    ingredientReferences?: Array<IngredientReferences>;
};


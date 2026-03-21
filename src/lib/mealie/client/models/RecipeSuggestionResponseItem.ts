/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IngredientFood_Output } from './IngredientFood_Output';
import type { RecipeSummary } from './RecipeSummary';
import type { RecipeTool } from './RecipeTool';
export type RecipeSuggestionResponseItem = {
    recipe: RecipeSummary;
    missingFoods: Array<IngredientFood_Output>;
    missingTools: Array<RecipeTool>;
};


/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateIngredientFood } from './CreateIngredientFood';
import type { CreateIngredientUnit } from './CreateIngredientUnit';
import type { IngredientFood_Output } from './IngredientFood_Output';
import type { IngredientUnit_Output } from './IngredientUnit_Output';
import type { Recipe_Output } from './Recipe_Output';
export type RecipeIngredient_Output = {
    quantity?: (number | null);
    unit?: (IngredientUnit_Output | CreateIngredientUnit | null);
    food?: (IngredientFood_Output | CreateIngredientFood | null);
    referencedRecipe?: (Recipe_Output | null);
    note?: (string | null);
    display?: string;
    title?: (string | null);
    originalText?: (string | null);
    referenceId?: string;
};


/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IngredientFood_Output } from './IngredientFood_Output';
import type { IngredientUnit_Output } from './IngredientUnit_Output';
import type { MultiPurposeLabelSummary } from './MultiPurposeLabelSummary';
import type { Recipe_Output } from './Recipe_Output';
import type { ShoppingListItemRecipeRefOut } from './ShoppingListItemRecipeRefOut';
export type ShoppingListItemOut_Output = {
    quantity?: number;
    unit?: (IngredientUnit_Output | null);
    food?: (IngredientFood_Output | null);
    referencedRecipe?: (Recipe_Output | null);
    note?: (string | null);
    display?: string;
    shoppingListId: string;
    checked?: boolean;
    position?: number;
    foodId?: (string | null);
    labelId?: (string | null);
    unitId?: (string | null);
    extras?: (Record<string, any> | null);
    id: string;
    groupId: string;
    householdId: string;
    label?: (MultiPurposeLabelSummary | null);
    recipeReferences?: Array<ShoppingListItemRecipeRefOut>;
    createdAt?: (string | null);
    updatedAt?: (string | null);
};


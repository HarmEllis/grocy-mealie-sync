/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IngredientFood_Input } from './IngredientFood_Input';
import type { IngredientUnit_Input } from './IngredientUnit_Input';
import type { MultiPurposeLabelSummary } from './MultiPurposeLabelSummary';
import type { Recipe_Input } from './Recipe_Input';
import type { ShoppingListItemRecipeRefOut } from './ShoppingListItemRecipeRefOut';
export type ShoppingListItemOut_Input = {
    quantity?: number;
    unit?: (IngredientUnit_Input | null);
    food?: (IngredientFood_Input | null);
    referencedRecipe?: (Recipe_Input | null);
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
    update_at?: (string | null);
};


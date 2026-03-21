/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateIngredientFood } from './CreateIngredientFood';
import type { CreateIngredientUnit } from './CreateIngredientUnit';
import type { IngredientFood_Input } from './IngredientFood_Input';
import type { IngredientUnit_Input } from './IngredientUnit_Input';
import type { Recipe_Input } from './Recipe_Input';
import type { ShoppingListItemRecipeRefCreate } from './ShoppingListItemRecipeRefCreate';
import type { ShoppingListItemRecipeRefUpdate } from './ShoppingListItemRecipeRefUpdate';
export type ShoppingListItemUpdate = {
    quantity?: number;
    unit?: (IngredientUnit_Input | CreateIngredientUnit | null);
    food?: (IngredientFood_Input | CreateIngredientFood | null);
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
    recipeReferences?: Array<(ShoppingListItemRecipeRefCreate | ShoppingListItemRecipeRefUpdate)>;
};


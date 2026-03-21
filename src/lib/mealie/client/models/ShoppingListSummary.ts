/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ShoppingListMultiPurposeLabelOut } from './ShoppingListMultiPurposeLabelOut';
import type { ShoppingListRecipeRefOut } from './ShoppingListRecipeRefOut';
export type ShoppingListSummary = {
    name?: (string | null);
    extras?: (Record<string, any> | null);
    createdAt?: (string | null);
    updatedAt?: (string | null);
    groupId: string;
    userId: string;
    id: string;
    householdId: string;
    recipeReferences: Array<ShoppingListRecipeRefOut>;
    labelSettings: Array<ShoppingListMultiPurposeLabelOut>;
};


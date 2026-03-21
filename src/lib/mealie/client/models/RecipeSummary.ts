/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RecipeCategory } from './RecipeCategory';
import type { RecipeTag } from './RecipeTag';
import type { RecipeTool } from './RecipeTool';
export type RecipeSummary = {
    id?: (string | null);
    userId?: string;
    householdId?: string;
    groupId?: string;
    name?: (string | null);
    slug?: string;
    image?: null;
    recipeServings?: number;
    recipeYieldQuantity?: number;
    recipeYield?: (string | null);
    totalTime?: (string | null);
    prepTime?: (string | null);
    cookTime?: (string | null);
    performTime?: (string | null);
    description?: (string | null);
    recipeCategory?: (Array<RecipeCategory> | null);
    tags?: (Array<RecipeTag> | null);
    tools?: Array<RecipeTool>;
    rating?: (number | null);
    orgURL?: (string | null);
    dateAdded?: (string | null);
    dateUpdated?: (string | null);
    createdAt?: (string | null);
    updatedAt?: (string | null);
    lastMade?: (string | null);
};


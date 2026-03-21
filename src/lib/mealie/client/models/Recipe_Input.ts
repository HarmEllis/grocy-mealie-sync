/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Nutrition } from './Nutrition';
import type { RecipeAsset } from './RecipeAsset';
import type { RecipeCategory } from './RecipeCategory';
import type { RecipeCommentOut_Input } from './RecipeCommentOut_Input';
import type { RecipeIngredient_Input } from './RecipeIngredient_Input';
import type { RecipeNote } from './RecipeNote';
import type { RecipeSettings } from './RecipeSettings';
import type { RecipeStep } from './RecipeStep';
import type { RecipeTag } from './RecipeTag';
import type { RecipeTool } from './RecipeTool';
export type Recipe_Input = {
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
    update_at?: (string | null);
    lastMade?: (string | null);
    recipeIngredient?: Array<RecipeIngredient_Input>;
    recipeInstructions?: (Array<RecipeStep> | null);
    nutrition?: (Nutrition | null);
    settings?: (RecipeSettings | null);
    assets?: (Array<RecipeAsset> | null);
    notes?: (Array<RecipeNote> | null);
    extras?: (Record<string, any> | null);
    comments?: (Array<RecipeCommentOut_Input> | null);
};


/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { PaginationBase_RecipeSummary_ } from '../models/PaginationBase_RecipeSummary_';
import type { Recipe_Output } from '../models/Recipe_Output';
import type { RecipeSuggestionResponse } from '../models/RecipeSuggestionResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ExploreRecipesService {
    /**
     * Get All
     * @param groupSlug
     * @param categories
     * @param tags
     * @param tools
     * @param foods
     * @param households
     * @param orderBy
     * @param orderByNullPosition
     * @param orderDirection
     * @param queryFilter
     * @param paginationSeed
     * @param page
     * @param perPage
     * @param cookbook
     * @param requireAllCategories
     * @param requireAllTags
     * @param requireAllTools
     * @param requireAllFoods
     * @param search
     * @param acceptLanguage
     * @returns PaginationBase_RecipeSummary_ Successful Response
     * @throws ApiError
     */
    public static getAllApiExploreGroupsGroupSlugRecipesGet(
        groupSlug: string,
        categories?: null,
        tags?: null,
        tools?: null,
        foods?: null,
        households?: null,
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        page: number = 1,
        perPage: number = 50,
        cookbook?: (string | null),
        requireAllCategories: boolean = false,
        requireAllTags: boolean = false,
        requireAllTools: boolean = false,
        requireAllFoods: boolean = false,
        search?: (string | null),
        acceptLanguage?: (string | null),
    ): CancelablePromise<PaginationBase_RecipeSummary_> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/explore/groups/{group_slug}/recipes',
            path: {
                'group_slug': groupSlug,
            },
            headers: {
                'accept-language': acceptLanguage,
            },
            query: {
                'categories': categories,
                'tags': tags,
                'tools': tools,
                'foods': foods,
                'households': households,
                'orderBy': orderBy,
                'orderByNullPosition': orderByNullPosition,
                'orderDirection': orderDirection,
                'queryFilter': queryFilter,
                'paginationSeed': paginationSeed,
                'page': page,
                'perPage': perPage,
                'cookbook': cookbook,
                'requireAllCategories': requireAllCategories,
                'requireAllTags': requireAllTags,
                'requireAllTools': requireAllTools,
                'requireAllFoods': requireAllFoods,
                'search': search,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Suggest Recipes
     * @param groupSlug
     * @param foods
     * @param tools
     * @param orderBy
     * @param orderByNullPosition
     * @param orderDirection
     * @param queryFilter
     * @param paginationSeed
     * @param limit
     * @param maxMissingFoods
     * @param maxMissingTools
     * @param includeFoodsOnHand
     * @param includeToolsOnHand
     * @param acceptLanguage
     * @returns RecipeSuggestionResponse Successful Response
     * @throws ApiError
     */
    public static suggestRecipesApiExploreGroupsGroupSlugRecipesSuggestionsGet(
        groupSlug: string,
        foods?: (Array<string> | null),
        tools?: (Array<string> | null),
        orderBy?: (string | null),
        orderByNullPosition?: (OrderByNullPosition | null),
        orderDirection: OrderDirection = 'desc',
        queryFilter?: (string | null),
        paginationSeed?: (string | null),
        limit: number = 10,
        maxMissingFoods: number = 5,
        maxMissingTools: number = 5,
        includeFoodsOnHand: boolean = true,
        includeToolsOnHand: boolean = true,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeSuggestionResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/explore/groups/{group_slug}/recipes/suggestions',
            path: {
                'group_slug': groupSlug,
            },
            headers: {
                'accept-language': acceptLanguage,
            },
            query: {
                'foods': foods,
                'tools': tools,
                'orderBy': orderBy,
                'orderByNullPosition': orderByNullPosition,
                'orderDirection': orderDirection,
                'queryFilter': queryFilter,
                'paginationSeed': paginationSeed,
                'limit': limit,
                'maxMissingFoods': maxMissingFoods,
                'maxMissingTools': maxMissingTools,
                'includeFoodsOnHand': includeFoodsOnHand,
                'includeToolsOnHand': includeToolsOnHand,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Recipe
     * @param recipeSlug
     * @param groupSlug
     * @param acceptLanguage
     * @returns Recipe_Output Successful Response
     * @throws ApiError
     */
    public static getRecipeApiExploreGroupsGroupSlugRecipesRecipeSlugGet(
        recipeSlug: string,
        groupSlug: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<Recipe_Output> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/explore/groups/{group_slug}/recipes/{recipe_slug}',
            path: {
                'recipe_slug': recipeSlug,
                'group_slug': groupSlug,
            },
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}

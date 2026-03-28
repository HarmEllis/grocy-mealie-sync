/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Body_create_recipe_from_image_api_recipes_create_image_post } from '../models/Body_create_recipe_from_image_api_recipes_create_image_post';
import type { Body_create_recipe_from_zip_api_recipes_create_zip_post } from '../models/Body_create_recipe_from_zip_api_recipes_create_zip_post';
import type { Body_update_recipe_image_api_recipes__slug__image_put } from '../models/Body_update_recipe_image_api_recipes__slug__image_put';
import type { Body_upload_recipe_asset_api_recipes__slug__assets_post } from '../models/Body_upload_recipe_asset_api_recipes__slug__assets_post';
import type { CreateRecipe } from '../models/CreateRecipe';
import type { CreateRecipeByUrlBulk } from '../models/CreateRecipeByUrlBulk';
import type { OrderByNullPosition } from '../models/OrderByNullPosition';
import type { OrderDirection } from '../models/OrderDirection';
import type { PaginationBase_RecipeSummary_ } from '../models/PaginationBase_RecipeSummary_';
import type { Recipe_Input } from '../models/Recipe_Input';
import type { Recipe_Output } from '../models/Recipe_Output';
import type { RecipeAsset } from '../models/RecipeAsset';
import type { RecipeDuplicate } from '../models/RecipeDuplicate';
import type { RecipeLastMade } from '../models/RecipeLastMade';
import type { RecipeSuggestionResponse } from '../models/RecipeSuggestionResponse';
import type { ScrapeRecipe } from '../models/ScrapeRecipe';
import type { ScrapeRecipeData } from '../models/ScrapeRecipeData';
import type { ScrapeRecipeTest } from '../models/ScrapeRecipeTest';
import type { UpdateImageResponse } from '../models/UpdateImageResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class RecipeCrudService {
    /**
     * Test Parse Recipe Url
     * @param requestBody
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static testParseRecipeUrlApiRecipesTestScrapeUrlPost(
        requestBody: ScrapeRecipeTest,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/recipes/test-scrape-url',
            headers: {
                'accept-language': acceptLanguage,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create Recipe From Html Or Json
     * Takes in raw HTML or a https://schema.org/Recipe object as a JSON string and parses it like a URL
     * @param requestBody
     * @param acceptLanguage
     * @returns string Successful Response
     * @throws ApiError
     */
    public static createRecipeFromHtmlOrJsonApiRecipesCreateHtmlOrJsonPost(
        requestBody: ScrapeRecipeData,
        acceptLanguage?: (string | null),
    ): CancelablePromise<string> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/recipes/create/html-or-json',
            headers: {
                'accept-language': acceptLanguage,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create Recipe From Html Or Json Stream
     * Takes in raw HTML or a https://schema.org/Recipe object as a JSON string and parses it like a URL,
     * streaming progress via SSE
     * @param requestBody
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static createRecipeFromHtmlOrJsonStreamApiRecipesCreateHtmlOrJsonStreamPost(
        requestBody: ScrapeRecipeData,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/recipes/create/html-or-json/stream',
            headers: {
                'accept-language': acceptLanguage,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Parse Recipe Url
     * Takes in a URL and attempts to scrape data and load it into the database
     * @param requestBody
     * @param acceptLanguage
     * @returns string Successful Response
     * @throws ApiError
     */
    public static parseRecipeUrlApiRecipesCreateUrlPost(
        requestBody: ScrapeRecipe,
        acceptLanguage?: (string | null),
    ): CancelablePromise<string> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/recipes/create/url',
            headers: {
                'accept-language': acceptLanguage,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Parse Recipe Url Stream
     * Takes in a URL and attempts to scrape data and load it into the database,
     * streaming progress via SSE
     * @param requestBody
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static parseRecipeUrlStreamApiRecipesCreateUrlStreamPost(
        requestBody: ScrapeRecipe,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/recipes/create/url/stream',
            headers: {
                'accept-language': acceptLanguage,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Parse Recipe Url Bulk
     * Takes in a URL and attempts to scrape data and load it into the database
     * @param requestBody
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static parseRecipeUrlBulkApiRecipesCreateUrlBulkPost(
        requestBody: CreateRecipeByUrlBulk,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/recipes/create/url/bulk',
            headers: {
                'accept-language': acceptLanguage,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create Recipe From Zip
     * Create recipe from archive
     * @param formData
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static createRecipeFromZipApiRecipesCreateZipPost(
        formData: Body_create_recipe_from_zip_api_recipes_create_zip_post,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/recipes/create/zip',
            headers: {
                'accept-language': acceptLanguage,
            },
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create Recipe From Image
     * Create a recipe from an image using OpenAI.
     * Optionally specify a language for it to translate the recipe to.
     * @param formData
     * @param translateLanguage
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static createRecipeFromImageApiRecipesCreateImagePost(
        formData: Body_create_recipe_from_image_api_recipes_create_image_post,
        translateLanguage?: (string | null),
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/recipes/create/image',
            headers: {
                'accept-language': acceptLanguage,
            },
            query: {
                'translateLanguage': translateLanguage,
            },
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get All
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
    public static getAllApiRecipesGet(
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
            url: '/api/recipes',
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
     * Create One
     * Takes in a JSON string and loads data into the database as a new entry
     * @param requestBody
     * @param acceptLanguage
     * @returns string Successful Response
     * @throws ApiError
     */
    public static createOneApiRecipesPost(
        requestBody: CreateRecipe,
        acceptLanguage?: (string | null),
    ): CancelablePromise<string> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/recipes',
            headers: {
                'accept-language': acceptLanguage,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Many
     * @param requestBody
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static updateManyApiRecipesPut(
        requestBody: Array<Recipe_Input>,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/recipes',
            headers: {
                'accept-language': acceptLanguage,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Patch Many
     * @param requestBody
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static patchManyApiRecipesPatch(
        requestBody: Array<Recipe_Input>,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/recipes',
            headers: {
                'accept-language': acceptLanguage,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Suggest Recipes
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
    public static suggestRecipesApiRecipesSuggestionsGet(
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
            url: '/api/recipes/suggestions',
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
     * Get One
     * Takes in a recipe's slug or id and returns all data for a recipe
     * @param slug A recipe's slug or id
     * @param acceptLanguage
     * @returns Recipe_Output Successful Response
     * @throws ApiError
     */
    public static getOneApiRecipesSlugGet(
        slug: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<Recipe_Output> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/recipes/{slug}',
            path: {
                'slug': slug,
            },
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update One
     * Updates a recipe by existing slug and data.
     * @param slug
     * @param requestBody
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static updateOneApiRecipesSlugPut(
        slug: string,
        requestBody: Recipe_Input,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/recipes/{slug}',
            path: {
                'slug': slug,
            },
            headers: {
                'accept-language': acceptLanguage,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Patch One
     * Updates a recipe by existing slug and data.
     * @param slug
     * @param requestBody
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static patchOneApiRecipesSlugPatch(
        slug: string,
        requestBody: Recipe_Input,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/recipes/{slug}',
            path: {
                'slug': slug,
            },
            headers: {
                'accept-language': acceptLanguage,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete One
     * Deletes a recipe by slug
     * @param slug
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static deleteOneApiRecipesSlugDelete(
        slug: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/recipes/{slug}',
            path: {
                'slug': slug,
            },
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Duplicate One
     * Duplicates a recipe with a new custom name if given
     * @param slug
     * @param requestBody
     * @param acceptLanguage
     * @returns Recipe_Output Successful Response
     * @throws ApiError
     */
    public static duplicateOneApiRecipesSlugDuplicatePost(
        slug: string,
        requestBody: RecipeDuplicate,
        acceptLanguage?: (string | null),
    ): CancelablePromise<Recipe_Output> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/recipes/{slug}/duplicate',
            path: {
                'slug': slug,
            },
            headers: {
                'accept-language': acceptLanguage,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Last Made
     * Update a recipe's last made timestamp
     * @param slug
     * @param requestBody
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static updateLastMadeApiRecipesSlugLastMadePatch(
        slug: string,
        requestBody: RecipeLastMade,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/recipes/{slug}/last-made',
            path: {
                'slug': slug,
            },
            headers: {
                'accept-language': acceptLanguage,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Scrape Image Url
     * @param slug
     * @param requestBody
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static scrapeImageUrlApiRecipesSlugImagePost(
        slug: string,
        requestBody: ScrapeRecipe,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/recipes/{slug}/image',
            path: {
                'slug': slug,
            },
            headers: {
                'accept-language': acceptLanguage,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Recipe Image
     * @param slug
     * @param formData
     * @param acceptLanguage
     * @returns UpdateImageResponse Successful Response
     * @throws ApiError
     */
    public static updateRecipeImageApiRecipesSlugImagePut(
        slug: string,
        formData: Body_update_recipe_image_api_recipes__slug__image_put,
        acceptLanguage?: (string | null),
    ): CancelablePromise<UpdateImageResponse> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/recipes/{slug}/image',
            path: {
                'slug': slug,
            },
            headers: {
                'accept-language': acceptLanguage,
            },
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete Recipe Image
     * @param slug
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static deleteRecipeImageApiRecipesSlugImageDelete(
        slug: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/recipes/{slug}/image',
            path: {
                'slug': slug,
            },
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Upload Recipe Asset
     * Upload a file to store as a recipe asset
     * @param slug
     * @param formData
     * @param acceptLanguage
     * @returns RecipeAsset Successful Response
     * @throws ApiError
     */
    public static uploadRecipeAssetApiRecipesSlugAssetsPost(
        slug: string,
        formData: Body_upload_recipe_asset_api_recipes__slug__assets_post,
        acceptLanguage?: (string | null),
    ): CancelablePromise<RecipeAsset> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/recipes/{slug}/assets',
            path: {
                'slug': slug,
            },
            headers: {
                'accept-language': acceptLanguage,
            },
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}

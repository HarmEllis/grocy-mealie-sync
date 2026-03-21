/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Body_update_recipe_image_api_recipes__slug__image_put } from '../models/Body_update_recipe_image_api_recipes__slug__image_put';
import type { Body_upload_recipe_asset_api_recipes__slug__assets_post } from '../models/Body_upload_recipe_asset_api_recipes__slug__assets_post';
import type { ImageType } from '../models/ImageType';
import type { RecipeAsset } from '../models/RecipeAsset';
import type { ScrapeRecipe } from '../models/ScrapeRecipe';
import type { UpdateImageResponse } from '../models/UpdateImageResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class RecipeImagesAndAssetsService {
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
    /**
     * Get Recipe Img
     * Takes in a recipe id, returns the static image. This route is proxied in the docker image
     * and should not hit the API in production
     * @param recipeId
     * @param fileName
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getRecipeImgApiMediaRecipesRecipeIdImagesFileNameGet(
        recipeId: string,
        fileName: ImageType,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/media/recipes/{recipe_id}/images/{file_name}',
            path: {
                'recipe_id': recipeId,
                'file_name': fileName,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Recipe Timeline Event Img
     * Takes in a recipe id and event timeline id, returns the static image. This route is proxied in the docker image
     * and should not hit the API in production
     * @param recipeId
     * @param timelineEventId
     * @param fileName
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getRecipeTimelineEventImgApiMediaRecipesRecipeIdImagesTimelineTimelineEventIdFileNameGet(
        recipeId: string,
        timelineEventId: string,
        fileName: ImageType,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/media/recipes/{recipe_id}/images/timeline/{timeline_event_id}/{file_name}',
            path: {
                'recipe_id': recipeId,
                'timeline_event_id': timelineEventId,
                'file_name': fileName,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Recipe Asset
     * Returns a recipe asset
     * @param recipeId
     * @param fileName
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getRecipeAssetApiMediaRecipesRecipeIdAssetsFileNameGet(
        recipeId: string,
        fileName: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/media/recipes/{recipe_id}/assets/{file_name}',
            path: {
                'recipe_id': recipeId,
                'file_name': fileName,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get User Image
     * Takes in a recipe slug, returns the static image. This route is proxied in the docker image
     * and should not hit the API in production
     * @param userId
     * @param fileName
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getUserImageApiMediaUsersUserIdFileNameGet(
        userId: string,
        fileName: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/media/users/{user_id}/{file_name}',
            path: {
                'user_id': userId,
                'file_name': fileName,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Validation Text
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getValidationTextApiMediaDockerValidateTxtGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/media/docker/validate.txt',
        });
    }
}

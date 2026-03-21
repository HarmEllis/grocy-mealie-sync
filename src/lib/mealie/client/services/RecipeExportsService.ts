/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FormatResponse } from '../models/FormatResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class RecipeExportsService {
    /**
     * Get Recipe Formats And Templates
     * @param acceptLanguage
     * @returns FormatResponse Successful Response
     * @throws ApiError
     */
    public static getRecipeFormatsAndTemplatesApiRecipesExportsGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<FormatResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/recipes/exports',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Recipe As Format
     * ## Parameters
     * `template_name`: The name of the template to use to use in the exports listed. Template type will automatically
     * be set on the backend. Because of this, it's important that your templates have unique names. See available
     * names and formats in the /api/recipes/exports endpoint.
     * @param slug
     * @param templateName
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getRecipeAsFormatApiRecipesSlugExportsGet(
        slug: string,
        templateName: string,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/recipes/{slug}/exports',
            path: {
                'slug': slug,
            },
            headers: {
                'accept-language': acceptLanguage,
            },
            query: {
                'template_name': templateName,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}

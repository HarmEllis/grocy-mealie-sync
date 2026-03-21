/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IngredientRequest } from '../models/IngredientRequest';
import type { IngredientsRequest } from '../models/IngredientsRequest';
import type { ParsedIngredient } from '../models/ParsedIngredient';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class RecipeIngredientParserService {
    /**
     * Parse Ingredient
     * @param requestBody
     * @param acceptLanguage
     * @returns ParsedIngredient Successful Response
     * @throws ApiError
     */
    public static parseIngredientApiParserIngredientPost(
        requestBody: IngredientRequest,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ParsedIngredient> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/parser/ingredient',
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
     * Parse Ingredients
     * @param requestBody
     * @param acceptLanguage
     * @returns ParsedIngredient Successful Response
     * @throws ApiError
     */
    public static parseIngredientsApiParserIngredientsPost(
        requestBody: IngredientsRequest,
        acceptLanguage?: (string | null),
    ): CancelablePromise<Array<ParsedIngredient>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/parser/ingredients',
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
}

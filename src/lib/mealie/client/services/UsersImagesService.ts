/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Body_update_user_image_api_users__id__image_post } from '../models/Body_update_user_image_api_users__id__image_post';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class UsersImagesService {
    /**
     * Update User Image
     * Updates a User Image
     * @param id
     * @param formData
     * @param acceptLanguage
     * @returns any Successful Response
     * @throws ApiError
     */
    public static updateUserImageApiUsersIdImagePost(
        id: string,
        formData: Body_update_user_image_api_users__id__image_post,
        acceptLanguage?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/users/{id}/image',
            path: {
                'id': id,
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

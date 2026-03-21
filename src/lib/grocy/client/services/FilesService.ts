/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FileGroups } from '../models/FileGroups';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class FilesService {
    /**
     * Serves the given file
     * With proper Content-Type header
     * @param group The file group
     * @param fileName The file name (including extension)<br>**BASE64 encoded**
     * @param forceServeAs Force the file to be served as the given type
     * @param bestFitHeight Only when using `force_serve_as` = `picture`: Downscale the picture to the given height while maintaining the aspect ratio
     * @param bestFitWidth Only when using `force_serve_as` = `picture`: Downscale the picture to the given width while maintaining the aspect ratio
     * @returns binary The binary file contents (Content-Type header is automatically set based on the file type)
     * @throws ApiError
     */
    public static getFiles(
        group: FileGroups,
        fileName: string,
        forceServeAs?: 'picture',
        bestFitHeight?: number,
        bestFitWidth?: number,
    ): CancelablePromise<Blob> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/files/{group}/{fileName}',
            path: {
                'group': group,
                'fileName': fileName,
            },
            query: {
                'force_serve_as': forceServeAs,
                'best_fit_height': bestFitHeight,
                'best_fit_width': bestFitWidth,
            },
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
    /**
     * Uploads a single file
     * The file will be stored at /data/storage/{group}/{file_name} (you need to remember the group and file name to get or delete it again)
     * @param group The file group
     * @param fileName The file name (including extension)<br>**BASE64 encoded**
     * @param requestBody
     * @returns void
     * @throws ApiError
     */
    public static putFiles(
        group: FileGroups,
        fileName: string,
        requestBody?: Blob,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/files/{group}/{fileName}',
            path: {
                'group': group,
                'fileName': fileName,
            },
            body: requestBody,
            mediaType: 'application/octet-stream',
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
    /**
     * Deletes the given file
     * @param group The file group
     * @param fileName The file name (including extension)<br>**BASE64 encoded**
     * @returns void
     * @throws ApiError
     */
    public static deleteFiles(
        group: FileGroups,
        fileName: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/files/{group}/{fileName}',
            path: {
                'group': group,
                'fileName': fileName,
            },
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
}

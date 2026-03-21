/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateInviteToken } from '../models/CreateInviteToken';
import type { EmailInitationResponse } from '../models/EmailInitationResponse';
import type { EmailInvitation } from '../models/EmailInvitation';
import type { ReadInviteToken } from '../models/ReadInviteToken';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class HouseholdsInvitationsService {
    /**
     * Get Invite Tokens
     * @param acceptLanguage
     * @returns ReadInviteToken Successful Response
     * @throws ApiError
     */
    public static getInviteTokensApiHouseholdsInvitationsGet(
        acceptLanguage?: (string | null),
    ): CancelablePromise<Array<ReadInviteToken>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/invitations',
            headers: {
                'accept-language': acceptLanguage,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create Invite Token
     * @param requestBody
     * @param acceptLanguage
     * @returns ReadInviteToken Successful Response
     * @throws ApiError
     */
    public static createInviteTokenApiHouseholdsInvitationsPost(
        requestBody: CreateInviteToken,
        acceptLanguage?: (string | null),
    ): CancelablePromise<ReadInviteToken> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/invitations',
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
     * Email Invitation
     * @param requestBody
     * @param acceptLanguage
     * @returns EmailInitationResponse Successful Response
     * @throws ApiError
     */
    public static emailInvitationApiHouseholdsInvitationsEmailPost(
        requestBody: EmailInvitation,
        acceptLanguage?: (string | null),
    ): CancelablePromise<EmailInitationResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/invitations/email',
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

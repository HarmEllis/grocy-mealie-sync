/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateUserRegistration = {
    group?: (string | null);
    household?: (string | null);
    groupToken?: (string | null);
    email: string;
    username: string;
    fullName: string;
    password: string;
    passwordConfirm: string;
    advanced?: boolean;
    private?: boolean;
    seedData?: boolean;
    locale?: string;
};


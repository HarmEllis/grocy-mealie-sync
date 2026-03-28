/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AdminAboutInfo = {
    production: boolean;
    version: string;
    demoStatus: boolean;
    allowSignup: boolean;
    allowPasswordLogin: boolean;
    defaultGroupSlug?: (string | null);
    defaultHouseholdSlug?: (string | null);
    enableOidc: boolean;
    oidcRedirect: boolean;
    oidcProviderName: string;
    enableOpenai: boolean;
    enableOpenaiImageServices: boolean;
    enableOpenaiTranscriptionServices: boolean;
    tokenTime: number;
    versionLatest: string;
    apiPort: number;
    apiDocs: boolean;
    dbType: string;
    dbUrl?: (string | null);
    defaultGroup: string;
    defaultHousehold: string;
    buildId: string;
    recipeScraperVersion: string;
};


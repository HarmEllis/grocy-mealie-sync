/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * These events are in-sync with the EventTypes found in the EventBusService.
 * If you modify this, make sure to update the EventBusService as well.
 */
export type GroupEventNotifierOptions = {
    testMessage?: boolean;
    webhookTask?: boolean;
    recipeCreated?: boolean;
    recipeUpdated?: boolean;
    recipeDeleted?: boolean;
    userSignup?: boolean;
    dataMigrations?: boolean;
    dataExport?: boolean;
    dataImport?: boolean;
    mealplanEntryCreated?: boolean;
    mealplanEntryUpdated?: boolean;
    mealplanEntryDeleted?: boolean;
    shoppingListCreated?: boolean;
    shoppingListUpdated?: boolean;
    shoppingListDeleted?: boolean;
    cookbookCreated?: boolean;
    cookbookUpdated?: boolean;
    cookbookDeleted?: boolean;
    tagCreated?: boolean;
    tagUpdated?: boolean;
    tagDeleted?: boolean;
    categoryCreated?: boolean;
    categoryUpdated?: boolean;
    categoryDeleted?: boolean;
    labelCreated?: boolean;
    labelUpdated?: boolean;
    labelDeleted?: boolean;
};


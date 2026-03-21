/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Battery } from '../models/Battery';
import type { Chore } from '../models/Chore';
import type { ExposedEntity_IncludingUserEntities } from '../models/ExposedEntity_IncludingUserEntities';
import type { ExposedEntity_IncludingUserEntities_NotIncludingNotEditable } from '../models/ExposedEntity_IncludingUserEntities_NotIncludingNotEditable';
import type { ExposedEntity_NotIncludingNotDeletable } from '../models/ExposedEntity_NotIncludingNotDeletable';
import type { ExposedEntity_NotIncludingNotEditable } from '../models/ExposedEntity_NotIncludingNotEditable';
import type { ExposedEntity_NotIncludingNotListable } from '../models/ExposedEntity_NotIncludingNotListable';
import type { Location } from '../models/Location';
import type { Product } from '../models/Product';
import type { ProductBarcode } from '../models/ProductBarcode';
import type { QuantityUnit } from '../models/QuantityUnit';
import type { ShoppingListItem } from '../models/ShoppingListItem';
import type { StockEntry } from '../models/StockEntry';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class GenericEntityInteractionsService {
    /**
     * Returns all objects of the given entity
     * @param entity A valid entity name
     * @param queryArray An array of filter conditions, each of them is a string in the form of `<field><condition><value>` where<br>`<field>` is a valid field name<br>`<condition>` is a comparison operator, one of<br>&nbsp;&nbsp;`=` equal<br>&nbsp;&nbsp;`!=` not equal<br>&nbsp;&nbsp;`~` LIKE<br>&nbsp;&nbsp;`!~` not LIKE<br>&nbsp;&nbsp;`<` less<br>&nbsp;&nbsp;`>` greater<br>&nbsp;&nbsp;`<=` less or equal<br>&nbsp;&nbsp;`>=` greater or equal<br>&nbsp;&nbsp;`§` regular expression<br>`<value>` is the value to search for
     * @param order A valid field name by which the response should be ordered, use the separator `:` to specify the sort order (`asc` or `desc`, defaults to `asc` when omitted)
     * @param limit The maximum number of objects to return
     * @param offset The number of objects to skip
     * @returns any An entity object
     * @throws ApiError
     */
    public static getObjects(
        entity: ExposedEntity_NotIncludingNotListable,
        queryArray?: Array<string>,
        order?: string,
        limit?: number,
        offset?: number,
    ): CancelablePromise<Array<(Product | Chore | Battery | Location | QuantityUnit | ShoppingListItem | StockEntry | ProductBarcode)>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/objects/{entity}',
            path: {
                'entity': entity,
            },
            query: {
                'query[]': queryArray,
                'order': order,
                'limit': limit,
                'offset': offset,
            },
            errors: {
                400: `The operation was not successful`,
                500: `The operation was not successful (possible errors are invalid field names or conditions in filter parameters provided)`,
            },
        });
    }
    /**
     * Adds a single object of the given entity
     * @param entity A valid entity name
     * @param requestBody A valid entity object of the entity specified in parameter *entity*
     * @returns any The operation was successful
     * @throws ApiError
     */
    public static postObjects(
        entity: ExposedEntity_NotIncludingNotEditable,
        requestBody: (Product | Chore | Battery | Location | QuantityUnit | ShoppingListItem | StockEntry | ProductBarcode),
    ): CancelablePromise<{
        /**
         * The id of the created object
         */
        created_object_id?: number;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/objects/{entity}',
            path: {
                'entity': entity,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
    /**
     * Returns a single object of the given entity
     * @param entity A valid entity name
     * @param objectId A valid object id of the given entity
     * @returns any An entity object
     * @throws ApiError
     */
    public static getObjects1(
        entity: ExposedEntity_NotIncludingNotListable,
        objectId: number,
    ): CancelablePromise<(Product | Chore | Battery | Location | QuantityUnit | ShoppingListItem | StockEntry | ProductBarcode)> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/objects/{entity}/{objectId}',
            path: {
                'entity': entity,
                'objectId': objectId,
            },
            errors: {
                400: `The operation was not successful`,
                404: `Object not found`,
            },
        });
    }
    /**
     * Edits the given object of the given entity
     * @param entity A valid entity name
     * @param objectId A valid object id of the given entity
     * @param requestBody A valid entity object of the entity specified in parameter *entity*
     * @returns void
     * @throws ApiError
     */
    public static putObjects(
        entity: ExposedEntity_NotIncludingNotEditable,
        objectId: number,
        requestBody: (Product | Chore | Battery | Location | QuantityUnit | ShoppingListItem | StockEntry | ProductBarcode),
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/objects/{entity}/{objectId}',
            path: {
                'entity': entity,
                'objectId': objectId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
    /**
     * Deletes a single object of the given entity
     * @param entity A valid entity name
     * @param objectId A valid object id of the given entity
     * @returns void
     * @throws ApiError
     */
    public static deleteObjects(
        entity: ExposedEntity_NotIncludingNotDeletable,
        objectId: number,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/objects/{entity}/{objectId}',
            path: {
                'entity': entity,
                'objectId': objectId,
            },
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
    /**
     * Returns all userfields with their values of the given object of the given entity
     * @param entity A valid entity name
     * @param objectId A valid object id of the given entity
     * @returns any Key/value pairs of userfields
     * @throws ApiError
     */
    public static getUserfields(
        entity: ExposedEntity_IncludingUserEntities,
        objectId: string,
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/userfields/{entity}/{objectId}',
            path: {
                'entity': entity,
                'objectId': objectId,
            },
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
    /**
     * Edits the given userfields of the given object of the given entity
     * @param entity A valid entity name
     * @param objectId A valid object id of the given entity
     * @param requestBody A valid entity object of the entity specified in parameter *entity*
     * @returns void
     * @throws ApiError
     */
    public static putUserfields(
        entity: ExposedEntity_IncludingUserEntities_NotIncludingNotEditable,
        objectId: string,
        requestBody: any,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/userfields/{entity}/{objectId}',
            path: {
                'entity': entity,
                'objectId': objectId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `The operation was not successful`,
            },
        });
    }
}

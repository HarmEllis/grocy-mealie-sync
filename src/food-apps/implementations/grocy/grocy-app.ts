import {
  getObjectsByEntity,
  GetObjectsByEntityData,
  Options,
  postObjectsByEntity,
  PostObjectsByEntityData,
  putObjectsByEntityByObjectId,
  PutObjectsByEntityByObjectIdData,
  QuantityUnit,
} from '../../../api-clients/grocy';
import { client } from '../../../api-clients/grocy/client.gen';
import { getEnvironmentVariable } from '../../../utils/env';
import logger from '../../../utils/logger';
import { Unit } from '../../base/food-app-types';
import { FoodAppBase } from '../../base/food-app';
import { GrocyUnitsToUnits, unitToGrocyUnit } from './grocy-utils';

class GrocyApp implements FoodAppBase {
  constructor() {
    // Note that the Grocy API client does not return an error if the API key is invalid,
    // it will just return an empty response
    client.setConfig({
      baseUrl: getEnvironmentVariable('GROCY_URL'),
      headers: {
        'GROCY-API-KEY': `${getEnvironmentVariable('GROCY_API_KEY')}`,
      },
    });
  }
  toString(): string {
    return 'Grocy';
  }
  async getAllUnits(): Promise<Unit[]> {
    const options: Options<GetObjectsByEntityData, true> = {
      path: {
        entity: 'quantity_units',
      },
    };
    const response = await getObjectsByEntity(options);
    logger.debug(`Request to Grocy: ${JSON.stringify(options)}`);
    logger.debug('Response from Grocy:', response);
    if (!response.data) {
      throw new Error('No data in response from Grocy');
    }

    return GrocyUnitsToUnits(response.data as QuantityUnit[]);
  }
  async getUnitById(id: string): Promise<Unit | null> {
    const units = await this.getUnitsByQuery([`id=${id}`]);
    if (units.length > 1) throw new Error(`Multiple units found with id ${id}, expected one`);
    return units.shift() || null;
  }
  async getUnitByName(name: string): Promise<Unit | null> {
    const units = await this.getUnitsByQuery([`name=${name}`]);
    if (units.length > 1) throw new Error(`Multiple units found with name ${name}, expected one`);
    return units.shift() || null;
  }

  async focUnit(name: string, pluralName: string): Promise<Unit> {
    logger.debug(`Fetch or creating unit with name: ${name}`);
    const unit = await this.getUnitByName(name);
    if (unit) {
      return unit;
    }
    // If the unit does not exist, create it
    const newQuantityUnit: QuantityUnit = {
      name,
      name_plural: pluralName,
    };
    const options: Options<PostObjectsByEntityData, true> = {
      path: {
        entity: 'quantity_units',
      },
      body: newQuantityUnit,
    };
    logger.debug(`Not found, creating unit request: ${JSON.stringify(options)}`);
    const result = await postObjectsByEntity(options);
    if (!result.data.created_object_id) throw new Error(`Failed to create unit with name ${name}`);
    const newUnit = await this.getUnitById(result.data.created_object_id.toString());
    if (!newUnit) throw new Error(`Failed to create unit with name ${name}`);
    return newUnit;
  }

  async updateUnit(unit: Unit): Promise<void> {
    logger.debug(`Updating unit with name: ${unit.name}`);
    const grocyUnit = unitToGrocyUnit(unit);
    if (!grocyUnit.id) throw new Error(`Unit with name ${unit.name} does not have an ID`);
    const options: Options<PutObjectsByEntityByObjectIdData, true> = {
      body: grocyUnit,
      path: {
        entity: 'quantity_units',
        objectId: grocyUnit.id,
      },
    };
    await putObjectsByEntityByObjectId(options);
  }

  private async getUnitsByQuery(query: string[]): Promise<Unit[]> {
    const options: Options<GetObjectsByEntityData, true> = {
      path: {
        entity: 'quantity_units',
      },
      query: {
        'query[]': query,
      },
    };
    const response = await getObjectsByEntity(options);
    logger.debug(`Request to Grocy: ${JSON.stringify(options)}`);
    logger.debug('Response from Grocy:', response);
    if (!response.data) {
      throw new Error('No data in response from Grocy');
    }

    return GrocyUnitsToUnits(response.data as QuantityUnit[]);
  }
}

export default GrocyApp;

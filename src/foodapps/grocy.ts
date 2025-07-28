import {
  getObjectsByEntity,
  GetObjectsByEntityData,
  Options,
  QuantityUnit,
} from '../clients/grocy';
import { client } from '../clients/grocy/client.gen';
import { getEnvironmentVariable } from '../helpers/environment';
import logger from '../helpers/logger';
import { Unit } from '../types/foodapptypes';
import { FoodApp } from './abstracts/foodapp';
import { GrocyUnitToUnit, GrocyUnitsToUnits } from '../helpers/grocy';

class GrocyApp implements FoodApp {
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

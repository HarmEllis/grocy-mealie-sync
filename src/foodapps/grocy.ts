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
    const options: Options<GetObjectsByEntityData> = {
      path: {
        entity: 'quantity_units',
      },
    };
    const response = await getObjectsByEntity(options);
    logger.debug(`Request to Grocy:`, options);
    logger.debug('Response from Grocy:', response);
    if (!response.data) {
      throw new Error('No data in response from Grocy');
    }
    const grocyUnits: QuantityUnit[] = response.data.filter(
      (item): item is QuantityUnit => 'name' in item && 'id' in item,
    );

    const units: Unit[] = grocyUnits.map((unit) => ({
      id: unit.id!.toString(),
      name: unit.name!,
      pluralName: unit.name_plural,
      description: unit.description,
    }));
    return units;
  }

  getUnitById(id: string): Promise<Unit | null> {
    throw new Error('Method not implemented.');
  }
  getUnitByName(name: string): Promise<Unit | null> {
    throw new Error('Method not implemented.');
  }
}

export default GrocyApp;

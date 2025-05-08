import { client } from '../clients/mealie/client.gen';
import { getAllApiUnitsGet } from '../clients/mealie/sdk.gen';
import { IngredientUnitOutput } from '../clients/mealie/types.gen';
import { getEnvironmentVariable } from '../helpers/environment';
import logger from '../helpers/logger';
import { DataQuery, fetchAllPaginatedItems } from '../helpers/mealie';
import { Unit } from '../types/foodapptypes';
import { FoodApp } from './abstracts/foodapp';

class MealieApp implements FoodApp {
  constructor() {
    client.setConfig({
      baseUrl: getEnvironmentVariable('MEALIE_URL'),
      headers: {
        Authorization: `Bearer ${getEnvironmentVariable('MEALIE_API_KEY')}`,
      },
    });
  }

  async getAllUnits(): Promise<Unit[]> {
    // Implementation to fetch all units from Mealie
    logger.info('Retrieving units from Mealie');
    const unitOptions = { query: { orderBy: 'name', orderDirection: 'asc' } };
    const units: IngredientUnitOutput[] = await fetchAllPaginatedItems<IngredientUnitOutput>(
      getAllApiUnitsGet,
      unitOptions,
    );

    if (!units) {
      logger.error('No units in response from Mealie');
    } else {
      logger.info(`Retrieved ${units.length} units from Mealie`);
      logger.debug('Example unit:', units.pop());
    }
    return units;
  }

  async getUnitById(id: string): Promise<Unit | null> {
    // Implementation to fetch a unit by ID from Mealie
    return null;
  }

  async getUnitByName(name: string): Promise<Unit | null> {
    // Implementation to fetch a unit by name from Mealie
    logger.info(`Searching for unit '${name}' in Mealie`);
    const unitOptions: DataQuery = {
      query: { orderBy: 'name', orderDirection: 'asc', queryFilter: `name = "${name}"` },
    };
    const units: IngredientUnitOutput[] = await fetchAllPaginatedItems<IngredientUnitOutput>(
      getAllApiUnitsGet,
      unitOptions,
    );

    if (!units) {
      logger.error('No units in response from Mealie');
    } else {
      logger.debug(`Found ${units.length} units named '${name}' Mealie`);
      if (logger.isSillyEnabled()) {
        units.forEach((unit) => logger.silly('Unit:', unit));
      }
    }
    return units.pop() || null;
  }
}
export default MealieApp;

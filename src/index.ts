import logger from './helpers/logger';
import { getEnvironmentVariable } from './helpers/environment';

import { client, client as mealieClient } from './clients/mealie/client.gen';
import { getAllApiUnitsGet } from './clients/mealie/sdk.gen';
import { fetchAllPaginatedItems } from './helpers/mealie';
import { GetAllApiUnitsGetData, IngredientUnitOutput } from './clients/mealie/types.gen';

async function main(): Promise<void> {
  try {
    client.setConfig({
      baseUrl: getEnvironmentVariable('MEALIE_URL'),
      headers: {
        Authorization: `Bearer ${getEnvironmentVariable('MEALIE_API_KEY')}`,
      },
    });

    logger.info('Retrieving units from Mealie');
    const unitOptions = { query: { orderBy: 'name', perPage: 30 } };
    const units: IngredientUnitOutput[] = await fetchAllPaginatedItems<IngredientUnitOutput>(
      getAllApiUnitsGet,
      unitOptions,
    );

    if (!units || units.length === 0) {
      logger.warn('No units found in Mealie');
    } else {
      logger.info(`Retrieved ${units.length} units from Mealie`);
      logger.info('Units retrieved successfully');
      logger.debug('Example unit:', units.pop());
    }
  } catch (error) {
    logger.error('Error retrieving units from Mealie:', error);
  }
  logger.info('Exiting...');
  process.exit(0);
}
main();

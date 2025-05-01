import logger from './helpers/logger';
import { getAllUnits } from './mealie/mealie';

import { createClient } from '@hey-api/client-fetch';
import { client, client as mealieClient } from './clients/mealie/client.gen';
import { getAllApiUnitsGet } from './clients/mealie/sdk.gen';

import { getEnvironmentVariable } from './helpers/environment';

if (process.env.NODE_ENV !== 'production') {
  // The .env is only used in development
  // Container environment variables should be used in production
  require('dotenv').config();
}

logger.info('Retrieving units from Mealie');

async function main(): Promise<void> {
  try {
    client.setConfig({
      baseUrl: getEnvironmentVariable('MEALIE_URL'),
      headers: {
        Authorization: `Bearer ${getEnvironmentVariable('MEALIE_API_KEY')}`,
      },
    });
    const unitsList = await getAllApiUnitsGet();
    const units = unitsList.data?.items;
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

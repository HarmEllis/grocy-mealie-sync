import logger from './helpers/logger';
import { getAllUnits } from './mealie/mealie';

if (process.env.NODE_ENV !== 'production') {
  // The .env is only used in development
  // Container environment variables should be used in production
  require('dotenv').config();
}

logger.info('Retrieving units from Mealie');

async function main(): Promise<void> {
  try {
    const units = await getAllUnits();
    if (units.length === 0) {
      logger.warn('No units found in Mealie');
    } else {
      logger.info(`Retrieved ${units.length} units from Mealie`);
    }
    logger.info('Units retrieved successfully');
    logger.debug('Example unit:', units.pop());
  } catch (error) {
    logger.error('Error retrieving units from Mealie:', error);
  }
  logger.info('Exiting...');
  process.exit(0);
}
main();

import logger from './helpers/logger';
import { getAllUnits } from './mealie/mealie';

if (process.env.NODE_ENV !== 'production') {
  // The .env is only used in development
  // Container environment variables should be used in production
  require('dotenv').config();
}

logger.info('Retrieving units from Mealie');

(async () => {
  try {
    const units = await getAllUnits();
  } catch (error) {
    logger.error('Error retrieving units from Mealie:', error);
  }
  logger.info('Units retrieved successfully');
})();

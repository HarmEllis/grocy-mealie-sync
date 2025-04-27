import logger from './helpers/logger';
import { getAllUnits } from './mealie/mealie';

if (process.env.NODE_ENV !== 'production') {
  // The .env is only used in development
  // Container environment variables should be used in production
  require('dotenv').config();
}

logger.info('Retrieving units from Mealie');

getAllUnits();

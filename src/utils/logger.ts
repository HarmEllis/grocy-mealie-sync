import winston from 'winston';
import { getEnvironmentVariable } from './env';

const loglevel = getEnvironmentVariable('LOG_LEVEL');

const logger = winston.createLogger({
  level: loglevel, // Set the default log level to 'info'
  format: winston.format.combine(
    winston.format.timestamp(), // Add a timestamp to each log
    winston.format.json(), // Format the logs as JSON
  ),
  transports: [new winston.transports.Console()],
});

logger.info('Winston logger initialized with level ' + loglevel);

export default logger;

import winston from 'winston';

const loglevel = process.env.LOG_LEVEL || 'info'; // Default to 'info' if not set

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

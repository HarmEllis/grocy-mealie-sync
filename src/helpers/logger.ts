import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(), // Add a timestamp to each log
    winston.format.json(), // Format the logs as JSON
  ),
  transports: [new winston.transports.Console()],
});

export default logger;

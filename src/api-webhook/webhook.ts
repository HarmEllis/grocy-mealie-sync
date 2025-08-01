import Fastify from 'fastify';
import logger from '../utils/logger';

const fastify = Fastify({ logger: false });

fastify.ready(() => {
  logger.info('Webhook server is ready');
});

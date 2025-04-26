import Fastify from 'fastify';
import logger from '../helpers/logger';

const fastify = Fastify({ logger: false });

fastify.ready(() => {
  logger.error('Hello, fastify!');
});

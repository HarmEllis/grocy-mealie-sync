import { OpenAPI } from './client';
import { config } from '../config';

OpenAPI.BASE = config.grocyUrl + '/api';
OpenAPI.HEADERS = {
  'GROCY-API-KEY': config.grocyApiKey,
};

export * from './client';

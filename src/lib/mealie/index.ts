import { OpenAPI } from './client';
import { config } from '../config';

OpenAPI.BASE = config.mealieUrl;
OpenAPI.HEADERS = {
  'Authorization': `Bearer ${config.mealieApiToken}`,
};

export * from './client';

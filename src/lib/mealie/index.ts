import { OpenAPI } from './client';
import { config } from '../config';

OpenAPI.BASE = config.mealieUrl;
OpenAPI.HEADERS = {
  'Authorization': `Bearer ${config.mealieApiToken}`,
};
OpenAPI.ALLOW_INSECURE_TLS = config.allowInsecureTls;

export * from './client';

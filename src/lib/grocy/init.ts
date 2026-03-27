/**
 * Initializes the generated Grocy OpenAPI client with the app's config.
 * This is a side-effect-only module — import it to ensure the client
 * is configured before any service call is made.
 */
import { OpenAPI } from './client';
import { config } from '../config';

OpenAPI.BASE = config.grocyUrl + '/api';
OpenAPI.HEADERS = {
  'GROCY-API-KEY': config.grocyApiKey,
};
OpenAPI.ALLOW_INSECURE_TLS = config.allowInsecureTls;

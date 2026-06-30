import packageMetadata from '../../package.json';

export const appVersion = packageMetadata.version;

/**
 * Device API capability version, advertised on GET /api/device/v1/ping.
 * Bump when adding device-facing endpoints so the firmware can hide features
 * the connected server does not yet support.
 *   1 = initial scan/action/search/create/link contract
 *   2 = adds GET /api/device/v1/products/{id} (home-screen search → pick)
 *   3 = adds shoppingListAmount on device products (shopping-list count card)
 */
export const deviceApiVersion = 3;

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import packageJson from '../../package.json';
import {
  checkProductDuplicates,
  getProductOverview,
  searchProducts,
} from '@/lib/use-cases/products/catalog';
import {
  getStatusResource,
  listProductMappingsResource,
  listUnitMappingsResource,
  listUnmappedProductsResource,
  listUnmappedUnitsResource,
} from '@/lib/use-cases/resources/read-models';
import type { GrocyMealieSyncMcpServices } from './contracts';
import { registerCoreResources } from './resources/core';
import { registerProductResources } from './resources/products';
import { registerProductTools } from './tools/products';

export function createGrocyMealieSyncMcpServer(
  overrides: Partial<GrocyMealieSyncMcpServices> = {},
): McpServer {
  const services: GrocyMealieSyncMcpServices = {
    products: {
      searchProducts,
      getProductOverview,
      checkProductDuplicates,
      ...overrides.products,
    },
    resources: {
      getStatusResource,
      listProductMappingsResource,
      listUnitMappingsResource,
      listUnmappedProductsResource,
      listUnmappedUnitsResource,
      ...overrides.resources,
    },
  };

  const server = new McpServer({
    name: 'grocy-mealie-sync',
    version: packageJson.version,
  });

  registerProductTools(server, services.products);
  registerCoreResources(server, services.resources);
  registerProductResources(server, services.products);

  return server;
}

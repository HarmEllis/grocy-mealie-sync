import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import packageJson from '../../package.json';
import {
  checkProductDuplicates,
  getProductOverview,
  searchProducts,
} from '@/lib/use-cases/products/catalog';
import {
  getStatusResource,
  listOpenMappingConflictsResource,
  listProductMappingsResource,
  listUnitMappingsResource,
  listUnmappedProductsResource,
  listUnmappedUnitsResource,
} from '@/lib/use-cases/resources/read-models';
import {
  addShoppingListItem,
  checkShoppingListProduct,
  getShoppingListItemsResource,
  removeShoppingListItem,
} from '@/lib/use-cases/shopping/list';
import type { GrocyMealieSyncMcpServices } from './contracts';
import { registerCoreResources } from './resources/core';
import { registerProductResources } from './resources/products';
import { registerShoppingResources } from './resources/shopping';
import { registerProductTools } from './tools/products';
import { registerShoppingTools } from './tools/shopping';

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
      listOpenMappingConflictsResource,
      getShoppingListItemsResource,
      ...overrides.resources,
    },
    shopping: {
      getShoppingListItemsResource,
      checkShoppingListProduct,
      addShoppingListItem,
      removeShoppingListItem,
      ...overrides.shopping,
    },
  };

  const server = new McpServer({
    name: 'grocy-mealie-sync',
    version: packageJson.version,
  });

  registerProductTools(server, services.products);
  registerShoppingTools(server, services.shopping);
  registerCoreResources(server, services.resources);
  registerProductResources(server, services.products);
  registerShoppingResources(server, services.shopping);

  return server;
}

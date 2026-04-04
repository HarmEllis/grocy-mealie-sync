import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CatalogMcpServices } from '../contracts';
import { createJsonResourceContents } from '../helpers';

export function registerCatalogResources(server: McpServer, services: CatalogMcpServices) {
  server.registerResource(
    'catalog-locations',
    'gms://catalog/locations',
    {
      title: 'Catalog Locations',
      description: 'Current Grocy storage locations',
      mimeType: 'application/json',
    },
    async uri => createJsonResourceContents(uri.toString(), await services.listGrocyLocations()),
  );

  server.registerResource(
    'catalog-product-groups',
    'gms://catalog/product-groups',
    {
      title: 'Catalog Product Groups',
      description: 'Current Grocy product groups',
      mimeType: 'application/json',
    },
    async uri => createJsonResourceContents(uri.toString(), await services.listGrocyProductGroups()),
  );
}

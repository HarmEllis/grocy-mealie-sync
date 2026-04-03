import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResourceMcpServices } from '../contracts';
import { createJsonResourceContents } from '../helpers';

export function registerCoreResources(server: McpServer, services: ResourceMcpServices) {
  server.registerResource(
    'status',
    'gms://status',
    {
      title: 'Sync Status',
      description: 'High-level operational status of the sync app',
      mimeType: 'application/json',
    },
    async uri => createJsonResourceContents(uri.toString(), await services.getStatusResource()),
  );

  server.registerResource(
    'product-mappings',
    'gms://mappings/products',
    {
      title: 'Product Mappings',
      description: 'Current product mappings between Grocy and Mealie',
      mimeType: 'application/json',
    },
    async uri => createJsonResourceContents(uri.toString(), await services.listProductMappingsResource()),
  );

  server.registerResource(
    'unit-mappings',
    'gms://mappings/units',
    {
      title: 'Unit Mappings',
      description: 'Current unit mappings between Grocy and Mealie',
      mimeType: 'application/json',
    },
    async uri => createJsonResourceContents(uri.toString(), await services.listUnitMappingsResource()),
  );

  server.registerResource(
    'unmapped-products',
    'gms://products/unmapped',
    {
      title: 'Unmapped Products',
      description: 'Unmapped products across Grocy and Mealie',
      mimeType: 'application/json',
    },
    async uri => createJsonResourceContents(uri.toString(), await services.listUnmappedProductsResource()),
  );

  server.registerResource(
    'unmapped-units',
    'gms://units/unmapped',
    {
      title: 'Unmapped Units',
      description: 'Unmapped units across Grocy and Mealie',
      mimeType: 'application/json',
    },
    async uri => createJsonResourceContents(uri.toString(), await services.listUnmappedUnitsResource()),
  );

  server.registerResource(
    'open-mapping-conflicts',
    'gms://conflicts/open',
    {
      title: 'Open Mapping Conflicts',
      description: 'Current open mapping conflicts',
      mimeType: 'application/json',
    },
    async uri => createJsonResourceContents(uri.toString(), await services.listOpenMappingConflictsResource()),
  );
}

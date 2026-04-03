import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { InventoryMcpServices } from '../contracts';
import { createJsonResourceContents } from '../helpers';

export function registerInventoryResources(server: McpServer, services: InventoryMcpServices) {
  server.registerResource(
    'inventory-low-stock',
    'gms://inventory/low-stock',
    {
      title: 'Low-Stock Inventory',
      description: 'Mapped Grocy products that are currently below minimum stock',
      mimeType: 'application/json',
    },
    async uri => createJsonResourceContents(uri.toString(), await services.listLowStockProductsResource()),
  );
}

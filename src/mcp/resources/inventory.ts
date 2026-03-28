import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { InventoryMcpServices } from '../contracts';

function createJsonResourceContents(uri: string, data: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

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

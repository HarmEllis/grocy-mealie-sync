import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ShoppingMcpServices } from '../contracts';
import { createJsonResourceContents } from '../helpers';

export function registerShoppingResources(server: McpServer, services: ShoppingMcpServices) {
  server.registerResource(
    'shopping-items',
    'gms://shopping/items',
    {
      title: 'Shopping List Items',
      description: 'Current items on the configured Mealie shopping list',
      mimeType: 'application/json',
    },
    async uri => createJsonResourceContents(uri.toString(), await services.getShoppingListItemsResource()),
  );
}

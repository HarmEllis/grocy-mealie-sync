import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ShoppingMcpServices } from '../contracts';

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

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { UnitMcpServices } from '../contracts';

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

export function registerUnitResources(server: McpServer, services: UnitMcpServices) {
  server.registerResource(
    'unit-catalog',
    'gms://units/catalog',
    {
      title: 'Unit Catalog',
      description: 'Current Grocy and Mealie units with mapping references',
      mimeType: 'application/json',
    },
    async uri => createJsonResourceContents(uri.toString(), await services.getUnitCatalog()),
  );
}

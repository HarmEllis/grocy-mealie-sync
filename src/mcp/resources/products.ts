import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ProductMcpServices } from '../contracts';

function getSingleVariable(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

export function registerProductResources(server: McpServer, services: ProductMcpServices) {
  server.registerResource(
    'product-overview',
    new ResourceTemplate('gms://products/{productRef}', { list: undefined }),
    {
      title: 'Product Overview',
      description: 'Combined Grocy, Mealie, and mapping overview for one product reference',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const productRef = getSingleVariable(variables.productRef);
      const overview = await services.getProductOverview({ productRef });

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify(overview, null, 2),
          },
        ],
      };
    },
  );
}

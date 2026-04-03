import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ProductMcpServices } from '../contracts';
import { getSingleVariable } from '../helpers';

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

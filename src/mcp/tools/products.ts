import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ProductMcpServices } from '../contracts';
import { createJsonTextContent, createOkResult, formatCountMessage } from '../helpers';

export function registerProductTools(server: McpServer, services: ProductMcpServices) {
  server.registerTool(
    'products.search',
    {
      title: 'Search Products',
      description: 'Search products across Grocy, Mealie, and existing mappings',
      inputSchema: {
        query: z.string().trim().min(1),
        maxResults: z.number().int().min(1).max(50).optional(),
      },
    },
    async ({ query, maxResults = 10 }) => {
      const data = await services.searchProducts({ query, maxResults });
      const result = createOkResult(
        formatCountMessage(data.matches.length, 'product match'),
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'products.get_overview',
    {
      title: 'Get Product Overview',
      description: 'Load the combined Grocy, Mealie, and mapping overview for one product reference',
      inputSchema: {
        productRef: z.string().trim().min(1),
      },
    },
    async ({ productRef }) => {
      const data = await services.getProductOverview({ productRef });
      const result = createOkResult('Loaded product overview.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'products.check_duplicates',
    {
      title: 'Check Product Duplicates',
      description: 'Check likely duplicate products in Grocy and Mealie before creation',
      inputSchema: {
        name: z.string().trim().min(1),
        maxFuzzyResults: z.number().int().min(1).max(20).optional(),
      },
    },
    async ({ name, maxFuzzyResults = 5 }) => {
      const data = await services.checkProductDuplicates({ name, maxFuzzyResults });
      const exactCount = data.exactGrocyMatches.length + data.exactMealieMatches.length;
      const fuzzyCount = data.fuzzyGrocyMatches.length + data.fuzzyMealieMatches.length;
      const result = createOkResult(
        `Found ${exactCount} exact and ${fuzzyCount} fuzzy duplicate candidate${exactCount + fuzzyCount === 1 ? '' : 's'}.`,
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );
}

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CatalogMcpServices } from '../contracts';
import { createJsonTextContent, createOkResult, formatCountMessage } from '../helpers';

export function registerCatalogTools(server: McpServer, services: CatalogMcpServices) {
  server.registerTool(
    'catalog.list_locations',
    {
      title: 'List Grocy Locations',
      description: 'Return all Grocy storage locations (e.g. pantry, fridge, freezer) with their ids and names',
      inputSchema: {},
    },
    async () => {
      const data = await services.listGrocyLocations();
      const result = createOkResult(
        formatCountMessage(data.count, 'location'),
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'catalog.list_product_groups',
    {
      title: 'List Grocy Product Groups',
      description: 'Return all Grocy product groups (categories) with their ids and names',
      inputSchema: {},
    },
    async () => {
      const data = await services.listGrocyProductGroups();
      const result = createOkResult(
        formatCountMessage(data.count, 'product group'),
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );
}

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ShoppingMcpServices } from '../contracts';
import { createJsonTextContent, createOkResult, formatCountMessage } from '../helpers';

export function registerShoppingTools(server: McpServer, services: ShoppingMcpServices) {
  server.registerTool(
    'shopping.list_items',
    {
      title: 'List Shopping Items',
      description: 'Return the current items on the configured Mealie shopping list',
      inputSchema: {},
    },
    async () => {
      const data = await services.getShoppingListItemsResource();
      const result = createOkResult(
        formatCountMessage(data.counts.total, 'shopping list item'),
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'shopping.check_product',
    {
      title: 'Check Shopping Product',
      description: 'Check whether a product is already present on the configured Mealie shopping list',
      inputSchema: {
        foodId: z.string().trim().min(1).optional(),
        query: z.string().trim().min(1).optional(),
        includeChecked: z.boolean().optional(),
        maxResults: z.number().int().min(1).max(20).optional(),
      },
    },
    async ({ foodId, query, includeChecked = false, maxResults = 10 }) => {
      const data = await services.checkShoppingListProduct({
        foodId,
        query,
        includeChecked,
        maxResults,
      });
      const result = createOkResult(
        data.alreadyOnList
          ? `Found ${data.matchCount} matching shopping list item${data.matchCount === 1 ? '' : 's'}.`
          : 'No matching shopping list items found.',
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'shopping.add_item',
    {
      title: 'Add Shopping Item',
      description: 'Add a product to the configured Mealie shopping list and merge duplicates by default',
      inputSchema: {
        foodId: z.string().trim().min(1),
        quantity: z.number().positive().optional(),
        unitId: z.string().trim().min(1).nullable().optional(),
        note: z.string().trim().min(1).nullable().optional(),
        mergeIfExists: z.boolean().optional(),
      },
    },
    async ({ foodId, quantity = 1, unitId, note, mergeIfExists = true }) => {
      const data = await services.addShoppingListItem({
        foodId,
        quantity,
        unitId,
        note,
        mergeIfExists,
      });
      const result = createOkResult(
        data.action === 'updated'
          ? 'Merged into an existing shopping list item.'
          : 'Added a new shopping list item.',
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'shopping.remove_item',
    {
      title: 'Remove Shopping Item',
      description: 'Remove one item from the configured Mealie shopping list without checking it off',
      inputSchema: {
        itemId: z.string().trim().min(1),
      },
    },
    async ({ itemId }) => {
      const data = await services.removeShoppingListItem({ itemId });
      const result = createOkResult('Removed the shopping list item.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );
}

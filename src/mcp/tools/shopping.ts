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
      description: 'Add a product to the configured Mealie shopping list by food id or product name, merging duplicates by default. When using query, leading words are moved into the note when only a suffix matches.',
      inputSchema: {
        foodId: z.string().trim().min(1).optional()
          .describe('Direct Mealie food id. Provide either foodId or query, not both.'),
        query: z.string().trim().min(1).optional()
          .describe('Product name to resolve. Leading words are moved to the note when only a suffix matches.'),
        quantity: z.number().positive().optional(),
        unitId: z.string().trim().min(1).nullable().optional(),
        note: z.string().trim().min(1).nullable().optional(),
        mergeIfExists: z.boolean().optional(),
      },
    },
    async ({ foodId, query, quantity = 1, unitId, note, mergeIfExists = true }) => {
      const data = await services.addShoppingListItem({
        foodId,
        query,
        quantity,
        unitId,
        note,
        mergeIfExists,
      });
      const actionMessage = data.action === 'updated'
        ? 'Merged into an existing shopping list item.'
        : 'Added a new shopping list item.';
      const resolutionMessage = data.resolved?.resolution === 'suffix_note'
        ? ` Resolved "${data.resolved.query}" to "${data.resolved.foodName}" and appended "${data.resolved.derivedNote}" to the note.`
        : '';
      const result = createOkResult(`${actionMessage}${resolutionMessage}`, data);

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

  server.registerTool(
    'shopping.set_checked',
    {
      title: 'Set Shopping Item Checked State',
      description: 'Mark one Mealie shopping list item as checked or unchecked',
      inputSchema: {
        itemId: z.string().trim().min(1),
        checked: z.boolean(),
      },
    },
    async ({ itemId, checked }) => {
      const data = await services.updateShoppingListItem({ itemId, checked });
      const result = createOkResult(
        checked
          ? 'Marked the shopping list item as checked.'
          : 'Marked the shopping list item as unchecked.',
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'shopping.update_quantity',
    {
      title: 'Update Shopping Item Quantity',
      description: 'Set the exact quantity for one Mealie shopping list item',
      inputSchema: {
        itemId: z.string().trim().min(1),
        quantity: z.number().min(0),
      },
    },
    async ({ itemId, quantity }) => {
      const data = await services.updateShoppingListItem({ itemId, quantity });
      const result = createOkResult('Updated the shopping list item quantity.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'shopping.merge_duplicates',
    {
      title: 'Merge Shopping Duplicates',
      description: 'Merge unchecked duplicate shopping list items for one Mealie food id',
      inputSchema: {
        foodId: z.string().trim().min(1),
      },
    },
    async ({ foodId }) => {
      const data = await services.mergeShoppingListDuplicates({ foodId });
      const result = createOkResult(
        data.merged
          ? 'Merged duplicate shopping list items.'
          : 'No duplicate shopping list items needed merging.',
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );
}

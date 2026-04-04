import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { InventoryMcpServices } from '../contracts';
import { createJsonTextContent, createOkResult, formatCountMessage } from '../helpers';
import { productRefSchema } from '../schemas';

export function registerInventoryTools(server: McpServer, services: InventoryMcpServices) {
  server.registerTool(
    'inventory.get_stock',
    {
      title: 'Get Inventory Stock',
      description: 'Load the current Grocy stock state for one product reference',
      inputSchema: {
        productRef: productRefSchema,
      },
    },
    async ({ productRef }) => {
      const data = await services.getInventoryStock({ productRef });
      const result = createOkResult('Loaded current stock state.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'inventory.list_entries',
    {
      title: 'List Inventory Entries',
      description: 'List the individual Grocy stock entries for one product reference',
      inputSchema: {
        productRef: productRefSchema,
      },
    },
    async ({ productRef }) => {
      const data = await services.listInventoryEntries({ productRef });
      const result = createOkResult(
        formatCountMessage(data.count, 'inventory entry'),
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'inventory.get_entry',
    {
      title: 'Get Inventory Entry',
      description: 'Load one Grocy stock entry by its entry id',
      inputSchema: {
        entryId: z.number().int().positive(),
      },
    },
    async ({ entryId }) => {
      const data = await services.getInventoryEntry({ entryId });
      const result = createOkResult('Loaded the inventory entry.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'inventory.list_low_stock',
    {
      title: 'List Low-Stock Products',
      description: 'List mapped Grocy products that are currently below minimum stock',
      inputSchema: {},
    },
    async () => {
      const data = await services.listLowStockProductsResource();
      const result = createOkResult(
        formatCountMessage(data.count, 'low-stock product'),
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'inventory.add_stock',
    {
      title: 'Add Stock',
      description: 'Add stock in Grocy with an optional best-before date, note, and opened amount',
      inputSchema: {
        productRef: productRefSchema,
        amount: z.number().positive(),
        openedAmount: z.number().min(0).optional(),
        bestBeforeDate: z.string().trim().min(1).nullable().optional(),
        note: z.string().trim().min(1).nullable().optional(),
      },
    },
    async ({ productRef, amount, openedAmount, bestBeforeDate, note }) => {
      const data = await services.addStock({ productRef, amount, openedAmount, bestBeforeDate, note });
      const result = createOkResult('Added stock in Grocy.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'inventory.consume_stock',
    {
      title: 'Consume Stock',
      description: 'Remove stock in Grocy because it was used or consumed',
      inputSchema: {
        productRef: productRefSchema,
        amount: z.number().positive(),
        spoiled: z.boolean().optional(),
        exactAmount: z.boolean().optional(),
      },
    },
    async ({ productRef, amount, spoiled = false, exactAmount = false }) => {
      const data = await services.consumeStock({ productRef, amount, spoiled, exactAmount });
      const result = createOkResult('Removed stock in Grocy.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'inventory.set_stock',
    {
      title: 'Set Stock',
      description: 'Correct the Grocy stock amount to an exact target value and optionally target an opened amount',
      inputSchema: {
        productRef: productRefSchema,
        amount: z.number().min(0),
        openedAmount: z.number().min(0).optional(),
        bestBeforeDate: z.string().trim().min(1).nullable().optional(),
        note: z.string().trim().min(1).nullable().optional(),
      },
    },
    async ({ productRef, amount, openedAmount, bestBeforeDate, note }) => {
      const data = await services.setStock({ productRef, amount, openedAmount, bestBeforeDate, note });
      const result = createOkResult('Set the exact stock amount in Grocy.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'inventory.mark_opened',
    {
      title: 'Mark Stock Opened',
      description: 'Mark an amount of Grocy stock as opened',
      inputSchema: {
        productRef: productRefSchema,
        amount: z.number().positive().optional(),
      },
    },
    async ({ productRef, amount = 1 }) => {
      const data = await services.markStockOpened({ productRef, amount });
      const result = createOkResult('Marked stock as opened in Grocy.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'inventory.update_entry',
    {
      title: 'Update Inventory Entry',
      description: 'Update an existing Grocy stock entry. Editable fields are amount, best-before date, price, open flag, location id, shopping location id, and purchased date.',
      inputSchema: {
        entryId: z.number().int().positive(),
        amount: z.number().positive().optional(),
        bestBeforeDate: z.string().trim().min(1).optional(),
        price: z.number().min(0).optional(),
        open: z.boolean().optional(),
        locationId: z.number().int().positive().optional(),
        shoppingLocationId: z.number().int().positive().optional(),
        purchasedDate: z.string().trim().min(1).optional(),
      },
    },
    async ({ entryId, amount, bestBeforeDate, price, open, locationId, shoppingLocationId, purchasedDate }) => {
      const data = await services.updateInventoryEntry({
        entryId,
        amount,
        bestBeforeDate,
        price,
        open,
        locationId,
        shoppingLocationId,
        purchasedDate,
      });
      const result = createOkResult('Updated the inventory entry.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );
}

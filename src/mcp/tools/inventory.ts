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
    'inventory.delete_entry',
    {
      title: 'Delete Inventory Entry',
      description: 'Delete a single Grocy stock entry by consuming it. Only works for entries with integer amounts; targeted deletion of fractional entries is not supported.',
      inputSchema: {
        entryId: z.number().int().positive(),
      },
    },
    async ({ entryId }) => {
      const data = await services.deleteInventoryEntry({ entryId });
      const result = createOkResult('Deleted the inventory entry.', data);

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
      description: 'Add stock to a Grocy product by amount, with optional best-before date, note, and opened amount. Use inventory.create_entry when you need entry-level fields such as purchased date or location.',
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
      description: 'Remove stock from a Grocy product by amount because it was used or consumed. Use inventory.delete_entry when you need to remove one specific stock entry.',
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
      description: 'Correct the total Grocy stock amount for a product to an exact target value and optionally target an opened amount. This works at the product level, not on one specific stock entry.',
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
    'inventory.create_entry',
    {
      title: 'Create Inventory Entry',
      description: 'Create new stock entries in Grocy with full field support including purchased date, location, and open state. Returns the created entries.',
      inputSchema: {
        productRef: productRefSchema,
        amount: z.number().positive(),
        bestBeforeDate: z.string().trim().min(1).nullable().optional(),
        purchasedDate: z.string().trim().min(1).optional(),
        locationId: z.number().int().positive().optional(),
        open: z.boolean().optional(),
        note: z.string().trim().min(1).nullable().optional(),
      },
    },
    async ({ productRef, amount, bestBeforeDate, purchasedDate, locationId, open, note }) => {
      const data = await services.createInventoryEntry({
        productRef,
        amount,
        bestBeforeDate,
        purchasedDate,
        locationId,
        open,
        note,
      });
      const noun = data.count === 1 ? 'entry' : 'entries';
      const message = data.warning ?? `Created ${data.count} inventory ${noun}.`;
      const result = createOkResult(message, data);

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
      description: 'Update an existing Grocy stock entry after inspecting it with inventory.list_entries or inventory.get_entry. Editable fields are amount, best-before date (or null to clear it), price, open flag, location id, shopping location id, and purchased date.',
      inputSchema: {
        entryId: z.number().int().positive(),
        amount: z.number().positive().optional(),
        bestBeforeDate: z.string().trim().min(1).nullable().optional(),
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

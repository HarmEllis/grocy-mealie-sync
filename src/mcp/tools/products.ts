import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ProductMcpServices } from '../contracts';
import { createJsonTextContent, createOkResult, formatCountMessage } from '../helpers';

const productRefSchema = z.string().trim().min(1).describe(
  'Accepts mapping:<id>, grocy:<id>, mealie:<id>, or a raw Grocy numeric id. Use products.search to find the productRef first.',
);

const verifiedGrocyUnitIdSchema = z.number().int().positive().describe(
  'Verified existing Grocy unit id only. Inspect units.list_catalog first and stop if the correct unit is unclear.',
);

export function registerProductTools(server: McpServer, services: ProductMcpServices) {
  server.registerTool(
    'products.list',
    {
      title: 'List Products',
      description: 'List Grocy products with optional filters. Defaults to mapped products only; use scope "all" to include unmapped products.',
      inputSchema: {
        scope: z.enum(['all', 'mapped']).optional().describe('Show all Grocy products or only mapped ones (default: mapped).'),
        stockGt: z.number().min(0).optional().describe('Only products with current stock greater than this value.'),
        hasMinStock: z.boolean().optional().describe('Only products with a minimum stock amount greater than 0.'),
        belowMinimum: z.boolean().optional().describe('Only products below their minimum stock level.'),
        locationId: z.number().int().positive().optional().describe('Only products in a specific Grocy location.'),
        productGroupId: z.number().int().positive().optional().describe('Only products in a specific Grocy product group.'),
        noOwnStock: z.boolean().optional().describe('Only products marked as not tracking own stock.'),
        shouldNotBeFrozen: z.boolean().optional().describe('Only products that should not be frozen.'),
      },
    },
    async (params) => {
      const data = await services.listProducts(params);
      const result = createOkResult(
        formatCountMessage(data.count, 'product'),
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

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
        productRef: productRefSchema,
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

  server.registerTool(
    'products.update_grocy_stock_settings',
    {
      title: 'Update Grocy Stock Settings',
      description: 'Update Grocy minimum stock and shelf-life related product defaults',
      inputSchema: {
        productRef: productRefSchema,
        minStockAmount: z.number().min(0).optional(),
        treatOpenedAsOutOfStock: z.boolean().optional(),
        defaultBestBeforeDays: z.number().int().min(0).nullable().optional(),
        defaultBestBeforeDaysAfterOpen: z.number().int().min(0).nullable().optional(),
        frozenShelfLifeDays: z.number().int().min(0).nullable().optional(),
        thawedShelfLifeDays: z.number().int().min(0).nullable().optional(),
        bestBeforeType: z.enum(['best_before', 'expiration']).optional(),
        allowFreezing: z.boolean().optional(),
      },
    },
    async (params) => {
      const data = await services.updateGrocyStockSettings(params);
      const result = createOkResult('Updated Grocy stock settings.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'products.create_in_both',
    {
      title: 'Create Product In Both Systems',
      description: 'Create a new product in Grocy and Mealie and store the mapping immediately',
      inputSchema: {
        name: z.string().trim().min(1),
        grocyUnitId: verifiedGrocyUnitIdSchema,
        locationId: z.number().int().positive().nullable().optional(),
        minStockAmount: z.number().min(0).optional(),
        mealiePluralName: z.string().trim().min(1).nullable().optional(),
        mealieAliases: z.array(z.string().trim().min(1)).optional(),
      },
    },
    async ({ name, grocyUnitId, locationId, minStockAmount, mealiePluralName, mealieAliases }) => {
      const data = await services.createProductInBoth({
        name,
        grocyUnitId,
        locationId,
        minStockAmount,
        mealiePluralName,
        mealieAliases,
      });
      const result = createOkResult(
        data.created
          ? 'Created the product in Grocy and Mealie and stored the mapping.'
          : 'Skipped product creation because exact duplicates already exist.',
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'products.create_grocy',
    {
      title: 'Create Product In Grocy',
      description: 'Create a new product in Grocy only. Use a verified existing Grocy unit and stop if the correct unit is unclear.',
      inputSchema: {
        name: z.string().trim().min(1),
        grocyUnitId: verifiedGrocyUnitIdSchema,
        locationId: z.number().int().positive().nullable().optional(),
        minStockAmount: z.number().min(0).optional(),
      },
    },
    async ({ name, grocyUnitId, locationId, minStockAmount }) => {
      const data = await services.createProductInGrocy({
        name,
        grocyUnitId,
        locationId,
        minStockAmount,
      });
      const result = createOkResult(
        data.created
          ? 'Created the product in Grocy.'
          : 'Skipped Grocy product creation because an exact duplicate already exists.',
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'products.create_mealie',
    {
      title: 'Create Product In Mealie',
      description: 'Create a new product in Mealie only',
      inputSchema: {
        name: z.string().trim().min(1),
        pluralName: z.string().trim().min(1).nullable().optional(),
        aliases: z.array(z.string().trim().min(1)).optional(),
      },
    },
    async ({ name, pluralName, aliases }) => {
      const data = await services.createProductInMealie({
        name,
        pluralName,
        aliases,
      });
      const result = createOkResult(
        data.created
          ? 'Created the product in Mealie.'
          : 'Skipped Mealie product creation because an exact duplicate already exists.',
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'products.update_basic',
    {
      title: 'Update Basic Product Metadata',
      description: 'Update the daily-use product metadata in Grocy and/or Mealie',
      inputSchema: {
        productRef: productRefSchema,
        grocyName: z.string().trim().min(1).optional(),
        mealieName: z.string().trim().min(1).optional(),
        mealiePluralName: z.string().trim().min(1).nullable().optional(),
        mealieAliases: z.array(z.string().trim().min(1)).optional(),
      },
    },
    async ({ productRef, grocyName, mealieName, mealiePluralName, mealieAliases }) => {
      const data = await services.updateBasicProduct({
        productRef,
        grocyName,
        mealieName,
        mealiePluralName,
        mealieAliases,
      });
      const result = createOkResult('Updated the basic product metadata.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'products.delete',
    {
      title: 'Delete Product',
      description: 'Delete one unmapped product from Grocy or Mealie. The product must not have an active mapping.',
      inputSchema: {
        productRef: productRefSchema,
        system: z.enum(['grocy', 'mealie']),
      },
    },
    async ({ productRef, system }) => {
      const data = await services.deleteProduct({ productRef, system });
      const result = createOkResult(
        `Deleted the product from ${system}.`,
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'products.update_units',
    {
      title: 'Update Product Units',
      description: 'Update the purchase and/or stock unit of a Grocy product. Use units.list_catalog first to find verified unit IDs.',
      inputSchema: {
        productRef: productRefSchema,
        grocyUnitIdPurchase: z.number().int().positive().optional().describe('Verified Grocy unit id for purchases.'),
        grocyUnitIdStock: z.number().int().positive().optional().describe('Verified Grocy unit id for stock.'),
      },
    },
    async ({ productRef, grocyUnitIdPurchase, grocyUnitIdStock }) => {
      const data = await services.updateProductUnits({
        productRef,
        grocyUnitIdPurchase,
        grocyUnitIdStock,
      });
      const result = createOkResult('Updated the product units.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );
}

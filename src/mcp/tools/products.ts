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

  server.registerTool(
    'products.update_grocy_stock_settings',
    {
      title: 'Update Grocy Stock Settings',
      description: 'Update Grocy minimum stock and shelf-life related product defaults',
      inputSchema: {
        productRef: z.string().trim().min(1),
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
        grocyUnitId: z.number().int().positive(),
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
      description: 'Create a new product in Grocy only',
      inputSchema: {
        name: z.string().trim().min(1),
        grocyUnitId: z.number().int().positive(),
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
        productRef: z.string().trim().min(1),
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
}

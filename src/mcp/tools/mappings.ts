import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MappingMcpServices } from '../contracts';
import { createJsonTextContent, createOkResult, formatCountMessage } from '../helpers';

const verifiedGrocyUnitIdSchema = z.number().int().positive().describe(
  'Verified existing Grocy unit id only. Inspect units.list_catalog first and stop if the correct unit is unclear.',
);

export function registerMappingTools(server: McpServer, services: MappingMcpServices) {
  server.registerTool(
    'mappings.list_products',
    {
      title: 'List Product Mappings',
      description: 'Return the current product mappings between Grocy and Mealie',
      inputSchema: {},
    },
    async () => {
      const data = await services.listProductMappingsResource();
      const result = createOkResult(
        formatCountMessage(data.count, 'product mapping'),
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'mappings.list_units',
    {
      title: 'List Unit Mappings',
      description: 'Return the current unit mappings between Grocy and Mealie',
      inputSchema: {},
    },
    async () => {
      const data = await services.listUnitMappingsResource();
      const result = createOkResult(
        formatCountMessage(data.count, 'unit mapping'),
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'mappings.list_unmapped',
    {
      title: 'List Unmapped Items',
      description: 'Return unmapped products and units across Grocy and Mealie',
      inputSchema: {},
    },
    async () => {
      const [products, units] = await Promise.all([
        services.listUnmappedProductsResource(),
        services.listUnmappedUnitsResource(),
      ]);
      const result = createOkResult('Loaded unmapped products and units.', { products, units });

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'mappings.suggest_products',
    {
      title: 'Suggest Product Mappings',
      description: 'Suggest likely product mappings for currently unmapped Mealie foods',
      inputSchema: {},
    },
    async () => {
      const data = await services.suggestProductMappings();
      const result = createOkResult(
        formatCountMessage(data.count, 'product mapping suggestion'),
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'mappings.suggest_units',
    {
      title: 'Suggest Unit Mappings',
      description: 'Suggest likely unit mappings for currently unmapped Mealie units',
      inputSchema: {},
    },
    async () => {
      const data = await services.suggestUnitMappings();
      const result = createOkResult(
        formatCountMessage(data.count, 'unit mapping suggestion'),
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'mappings.upsert_product',
    {
      title: 'Upsert Product Mapping',
      description: 'Create or update one product mapping between Mealie and Grocy',
      inputSchema: {
        mappingId: z.string().trim().min(1).optional(),
        mealieFoodId: z.string().trim().min(1),
        grocyProductId: z.number().int().positive(),
        grocyUnitId: verifiedGrocyUnitIdSchema.optional(),
      },
    },
    async ({ mappingId, mealieFoodId, grocyProductId, grocyUnitId }) => {
      const data = await services.upsertProductMapping({
        mappingId,
        mealieFoodId,
        grocyProductId,
        grocyUnitId,
      });
      const result = createOkResult('Upserted the product mapping.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'mappings.remove_product',
    {
      title: 'Remove Product Mapping',
      description: 'Remove one product mapping by id',
      inputSchema: {
        mappingId: z.string().trim().min(1),
      },
    },
    async ({ mappingId }) => {
      const data = await services.removeProductMapping({ mappingId });
      const result = createOkResult('Removed the product mapping.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'mappings.upsert_unit',
    {
      title: 'Upsert Unit Mapping',
      description: 'Create or update one unit mapping between Mealie and Grocy',
      inputSchema: {
        mappingId: z.string().trim().min(1).optional(),
        mealieUnitId: z.string().trim().min(1),
        grocyUnitId: z.number().int().positive(),
      },
    },
    async ({ mappingId, mealieUnitId, grocyUnitId }) => {
      const data = await services.upsertUnitMapping({
        mappingId,
        mealieUnitId,
        grocyUnitId,
      });
      const result = createOkResult('Upserted the unit mapping.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'mappings.remove_unit',
    {
      title: 'Remove Unit Mapping',
      description: 'Remove one unit mapping by id',
      inputSchema: {
        mappingId: z.string().trim().min(1),
      },
    },
    async ({ mappingId }) => {
      const data = await services.removeUnitMapping({ mappingId });
      const result = createOkResult('Removed the unit mapping.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );
}

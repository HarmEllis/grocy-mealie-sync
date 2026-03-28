import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { UnitMcpServices } from '../contracts';
import { createJsonTextContent, createOkResult, formatCountMessage } from '../helpers';

export function registerUnitTools(server: McpServer, services: UnitMcpServices) {
  server.registerTool(
    'units.list_catalog',
    {
      title: 'List Unit Catalog',
      description: 'Return the current Grocy and Mealie unit catalogs with mapping references',
      inputSchema: {},
    },
    async () => {
      const data = await services.getUnitCatalog();
      const result = createOkResult(
        formatCountMessage(data.counts.mappedUnits, 'unit catalog entry'),
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'units.update_grocy',
    {
      title: 'Update Grocy Unit',
      description: 'Update Grocy unit metadata such as name, plural name, and plural forms',
      inputSchema: {
        grocyUnitId: z.number().int().positive(),
        name: z.string().trim().min(1).optional(),
        pluralName: z.string().trim().min(1).nullable().optional(),
        pluralForms: z.array(z.string().trim().min(1)).optional(),
        description: z.string().trim().min(1).nullable().optional(),
      },
    },
    async ({ grocyUnitId, name, pluralName, pluralForms, description }) => {
      const data = await services.updateGrocyUnitMetadata({
        grocyUnitId,
        name,
        pluralName,
        pluralForms,
        description,
      });
      const result = createOkResult('Updated the Grocy unit metadata.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'units.compare',
    {
      title: 'Compare Units',
      description: 'Compare one Mealie unit against one Grocy unit',
      inputSchema: {
        mealieUnitId: z.string().trim().min(1),
        grocyUnitId: z.number().int().positive(),
      },
    },
    async ({ mealieUnitId, grocyUnitId }) => {
      const data = await services.compareUnits({ mealieUnitId, grocyUnitId });
      const result = createOkResult('Compared the selected units.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'units.normalize',
    {
      title: 'Normalize Units',
      description: 'Normalize mapped Grocy and Mealie unit metadata',
      inputSchema: {},
    },
    async () => {
      const data = await services.normalizeMappedUnits();
      const result = createOkResult('Normalized mapped unit metadata.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'units.update_mealie',
    {
      title: 'Update Mealie Unit',
      description: 'Update Mealie unit metadata such as names, abbreviations, and aliases',
      inputSchema: {
        mealieUnitId: z.string().trim().min(1),
        name: z.string().trim().min(1).optional(),
        pluralName: z.string().trim().min(1).nullable().optional(),
        abbreviation: z.string().trim().min(1).optional(),
        pluralAbbreviation: z.string().trim().min(1).nullable().optional(),
        aliases: z.array(z.string().trim().min(1)).optional(),
      },
    },
    async ({ mealieUnitId, name, pluralName, abbreviation, pluralAbbreviation, aliases }) => {
      const data = await services.updateMealieUnitMetadata({
        mealieUnitId,
        name,
        pluralName,
        abbreviation,
        pluralAbbreviation,
        aliases,
      });
      const result = createOkResult('Updated the Mealie unit metadata.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );
}

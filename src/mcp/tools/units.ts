import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { UnitMcpServices } from '../contracts';
import { createJsonTextContent, createOkResult, createSkippedResult, formatCountMessage } from '../helpers';

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
    'units.create_grocy',
    {
      title: 'Create Grocy Unit',
      description: 'Create a new Grocy unit and skip exact duplicate names',
      inputSchema: {
        name: z.string().trim().min(1),
        pluralName: z.string().trim().min(1).nullable().optional(),
        pluralForms: z.array(z.string().trim().min(1)).optional(),
        description: z.string().trim().min(1).nullable().optional(),
      },
    },
    async ({ name, pluralName, pluralForms, description }) => {
      const data = await services.createGrocyUnit({
        name,
        pluralName,
        pluralForms,
        description,
      });
      const createResult = data.created ? createOkResult : createSkippedResult;
      const result = createResult(
        data.created
          ? 'Created the Grocy unit.'
          : 'Skipped Grocy unit creation because an exact duplicate already exists.',
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'units.create_mealie',
    {
      title: 'Create Mealie Unit',
      description: 'Create a new Mealie unit and skip exact duplicate names',
      inputSchema: {
        name: z.string().trim().min(1),
        pluralName: z.string().trim().min(1).nullable().optional(),
        abbreviation: z.string().trim().min(1).optional(),
        pluralAbbreviation: z.string().trim().min(1).nullable().optional(),
        aliases: z.array(z.string().trim().min(1)).optional(),
        description: z.string().trim().min(1).nullable().optional(),
        fraction: z.boolean().optional(),
        useAbbreviation: z.boolean().optional(),
      },
    },
    async ({
      name,
      pluralName,
      abbreviation,
      pluralAbbreviation,
      aliases,
      description,
      fraction,
      useAbbreviation,
    }) => {
      const data = await services.createMealieUnit({
        name,
        pluralName,
        abbreviation,
        pluralAbbreviation,
        aliases,
        description,
        fraction,
        useAbbreviation,
      });
      const createResult = data.created ? createOkResult : createSkippedResult;
      const result = createResult(
        data.created
          ? 'Created the Mealie unit.'
          : 'Skipped Mealie unit creation because an exact duplicate already exists.',
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
    'units.delete_grocy',
    {
      title: 'Delete Grocy Unit',
      description: 'Delete one Grocy unit when it is no longer referenced by mappings, products, or conversions',
      inputSchema: {
        grocyUnitId: z.number().int().positive(),
      },
    },
    async ({ grocyUnitId }) => {
      const data = await services.deleteGrocyUnit({ grocyUnitId });
      const result = (data.deleted ? createOkResult : createSkippedResult)(
        data.deleted
          ? 'Deleted the Grocy unit.'
          : 'Skipped Grocy unit deletion because the unit is still in use.',
        data,
      );

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

  server.registerTool(
    'units.delete_mealie',
    {
      title: 'Delete Mealie Unit',
      description: 'Delete one Mealie unit when it is no longer referenced by mappings, shopping items, or recipe ingredients',
      inputSchema: {
        mealieUnitId: z.string().trim().min(1),
      },
    },
    async ({ mealieUnitId }) => {
      const data = await services.deleteMealieUnit({ mealieUnitId });
      const result = (data.deleted ? createOkResult : createSkippedResult)(
        data.deleted
          ? 'Deleted the Mealie unit.'
          : 'Skipped Mealie unit deletion because the unit is still in use.',
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );
}

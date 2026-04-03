import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConversionMcpServices } from '../contracts';
import { createJsonTextContent, createOkResult, createSkippedResult } from '../helpers';

export function registerConversionTools(server: McpServer, services: ConversionMcpServices) {
  server.registerTool(
    'conversions.list',
    {
      title: 'List Unit Conversions',
      description: 'List all Grocy unit conversions with resolved unit names. Shows both global conversions and product-specific overrides.',
      inputSchema: {},
    },
    async () => {
      const data = await services.listConversions();
      const result = createOkResult(`Found ${data.conversions.length} unit conversion(s).`, data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'conversions.create',
    {
      title: 'Create Unit Conversion',
      description: 'Create a Grocy unit conversion between two quantity units. Supports both global conversions (all products) and product-specific overrides. Checks for existing from→to and reverse to→from conversions before creating.',
      inputSchema: {
        fromGrocyUnitId: z.number().int().positive().describe('Source quantity unit ID'),
        toGrocyUnitId: z.number().int().positive().describe('Target quantity unit ID'),
        factor: z.number().positive().describe('Conversion factor: amount_in_to = amount_in_from * factor'),
        grocyProductId: z.number().int().positive().nullable().optional().describe('Product ID for product-specific conversion (null = global)'),
      },
    },
    async ({ fromGrocyUnitId, toGrocyUnitId, factor, grocyProductId }) => {
      const data = await services.createUnitConversion({
        fromGrocyUnitId,
        toGrocyUnitId,
        factor,
        grocyProductId,
      });

      let message: string;
      if (data.created) {
        message = 'Created the unit conversion.';
      } else if (data.duplicateCheck?.reverseConversion) {
        message = `Skipped: a reverse conversion (to→from) already exists with ID ${data.duplicateCheck.existingConversionId}.`;
      } else {
        message = `Skipped: the same from→to conversion already exists with ID ${data.duplicateCheck?.existingConversionId}.`;
      }

      const createResult = data.created ? createOkResult : createSkippedResult;
      const result = createResult(message, data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'conversions.delete',
    {
      title: 'Delete Unit Conversion',
      description: 'Delete a Grocy unit conversion by its ID. Use this to remove conversions after changing product units.',
      inputSchema: {
        conversionId: z.number().int().positive().describe('ID of the unit conversion to delete'),
      },
    },
    async ({ conversionId }) => {
      const data = await services.deleteUnitConversion({ conversionId });
      const result = createOkResult('Deleted the unit conversion.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );
}

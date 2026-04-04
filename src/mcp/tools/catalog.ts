import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CatalogMcpServices } from '../contracts';
import { createJsonTextContent, createOkResult, createSkippedResult, formatCountMessage } from '../helpers';

export function registerCatalogTools(server: McpServer, services: CatalogMcpServices) {
  server.registerTool(
    'catalog.list_locations',
    {
      title: 'List Grocy Locations',
      description: 'Return all Grocy storage locations (e.g. pantry, fridge, freezer) with their ids and names',
      inputSchema: {},
    },
    async () => {
      const data = await services.listGrocyLocations();
      const result = createOkResult(
        formatCountMessage(data.count, 'location'),
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'catalog.create_location',
    {
      title: 'Create Grocy Location',
      description: 'Create a new Grocy storage location',
      inputSchema: {
        name: z.string().trim().min(1),
        description: z.string().trim().min(1).nullable().optional(),
      },
    },
    async ({ name, description }) => {
      const data = await services.createGrocyLocation({ name, description });
      const result = createOkResult('Created the Grocy location.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'catalog.update_location',
    {
      title: 'Update Grocy Location',
      description: 'Update an existing Grocy storage location',
      inputSchema: {
        locationId: z.number().int().positive(),
        name: z.string().trim().min(1).optional(),
        description: z.string().trim().min(1).nullable().optional(),
      },
    },
    async ({ locationId, name, description }) => {
      const data = await services.updateGrocyLocation({ locationId, name, description });
      const result = createOkResult('Updated the Grocy location.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'catalog.delete_location',
    {
      title: 'Delete Grocy Location',
      description: 'Delete a Grocy storage location when it is no longer referenced by products or stock entries',
      inputSchema: {
        locationId: z.number().int().positive(),
      },
    },
    async ({ locationId }) => {
      const data = await services.deleteGrocyLocation({ locationId });
      const result = (data.deleted ? createOkResult : createSkippedResult)(
        data.deleted
          ? 'Deleted the Grocy location.'
          : 'Skipped Grocy location deletion because the location is still in use.',
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'catalog.list_product_groups',
    {
      title: 'List Grocy Product Groups',
      description: 'Return all Grocy product groups (categories) with their ids and names',
      inputSchema: {},
    },
    async () => {
      const data = await services.listGrocyProductGroups();
      const result = createOkResult(
        formatCountMessage(data.count, 'product group'),
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'catalog.create_product_group',
    {
      title: 'Create Grocy Product Group',
      description: 'Create a new Grocy product group',
      inputSchema: {
        name: z.string().trim().min(1),
        description: z.string().trim().min(1).nullable().optional(),
      },
    },
    async ({ name, description }) => {
      const data = await services.createGrocyProductGroup({ name, description });
      const result = createOkResult('Created the Grocy product group.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'catalog.update_product_group',
    {
      title: 'Update Grocy Product Group',
      description: 'Update an existing Grocy product group',
      inputSchema: {
        productGroupId: z.number().int().positive(),
        name: z.string().trim().min(1).optional(),
        description: z.string().trim().min(1).nullable().optional(),
      },
    },
    async ({ productGroupId, name, description }) => {
      const data = await services.updateGrocyProductGroup({ productGroupId, name, description });
      const result = createOkResult('Updated the Grocy product group.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'catalog.delete_product_group',
    {
      title: 'Delete Grocy Product Group',
      description: 'Delete a Grocy product group when it is no longer assigned to products',
      inputSchema: {
        productGroupId: z.number().int().positive(),
      },
    },
    async ({ productGroupId }) => {
      const data = await services.deleteGrocyProductGroup({ productGroupId });
      const result = (data.deleted ? createOkResult : createSkippedResult)(
        data.deleted
          ? 'Deleted the Grocy product group.'
          : 'Skipped Grocy product group deletion because the product group is still in use.',
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );
}

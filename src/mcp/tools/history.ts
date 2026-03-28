import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { HistoryMcpServices } from '../contracts';
import { createJsonTextContent, createOkResult, formatCountMessage } from '../helpers';

export function registerHistoryTools(server: McpServer, services: HistoryMcpServices) {
  server.registerTool(
    'history.list_runs',
    {
      title: 'List Recent History Runs',
      description: 'Return recent history runs recorded by the sync app',
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async ({ limit = 25 }) => {
      const data = await services.listRecentHistoryResource({ limit });
      const result = createOkResult(
        formatCountMessage(data.count, 'history run'),
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'history.get_run',
    {
      title: 'Get History Run',
      description: 'Return one detailed history run with its events',
      inputSchema: {
        runId: z.string().trim().min(1),
      },
    },
    async ({ runId }) => {
      const data = await services.getHistoryRunResource({ runId });
      const result = createOkResult('Loaded history run details.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );
}

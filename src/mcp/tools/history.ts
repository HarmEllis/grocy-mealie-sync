import { historyRunActions, historyRunTriggers, historyRunStatuses, getHistoryFeatureState } from '@/lib/history-store';
import { listHistoryActivityResource } from '@/lib/use-cases/history/read';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { HistoryMcpServices } from '../contracts';
import { createJsonTextContent, createOkResult, formatCountMessage } from '../helpers';

const filters = {
  search: z.string().max(200).optional(),
  action: z.enum(historyRunActions).optional(), trigger: z.enum(historyRunTriggers).optional(), status: z.enum(historyRunStatuses).optional(),
  dateFrom: z.union([z.iso.date(), z.iso.datetime({ offset: true })]).optional(),
  dateTo: z.union([z.iso.date(), z.iso.datetime({ offset: true })]).optional(),
};
function dates<T extends { dateFrom?: string; dateTo?: string }>(input: T) {
  const { dateFrom, dateTo, ...rest } = input;
  return { ...rest,
    ...(dateFrom ? { dateFrom: new Date(dateFrom.length === 10 ? `${dateFrom}T00:00:00` : dateFrom) } : {}),
    ...(dateTo ? { dateTo: new Date(dateTo.length === 10 ? `${dateTo}T23:59:59.999` : dateTo) } : {}),
  };
}

export function registerHistoryTools(server: McpServer, services: HistoryMcpServices) {
  server.registerTool('history.list_activity', {
    title: 'Read Product Activity',
    description: 'Read the same product-level history as the UI, with search, action, trigger, status, issue/mutation, date and pagination filters. Includes shop proposals, list plans and confirmed retailer changes.',
    inputSchema: { ...filters, limit: z.number().int().min(1).max(100).optional(), offset: z.number().int().min(0).max(100000).optional(), kind: z.enum(['mutation', 'issue']).optional() },
    annotations: { readOnlyHint: true },
  }, async input => {
    const data = await (services.listHistoryActivityResource ?? listHistoryActivityResource)(dates(input));
    const result = createOkResult('Loaded product history activity.', data);
    return { content: [createJsonTextContent(result)], structuredContent: result };
  });
  server.registerTool('history.status', { title: 'Read History Settings', description: 'Read whether history is enabled and its retention period.', inputSchema: {}, annotations: { readOnlyHint: true } }, async () => {
    const result = createOkResult('Loaded history settings.', getHistoryFeatureState());
    return { content: [createJsonTextContent(result)], structuredContent: result };
  });
  server.registerTool(
    'history.list_runs',
    {
      title: 'List Recent History Runs',
      description: 'Return recent history runs recorded by the sync app',
      inputSchema: {
        ...filters,
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async ({ limit = 25, ...query }) => {
      const data = await services.listRecentHistoryResource({ limit, ...dates(query) });
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

import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { HistoryMcpServices } from '../contracts';

function createJsonResourceContents(uri: string, data: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function getSingleVariable(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

export function registerHistoryResources(server: McpServer, services: HistoryMcpServices) {
  server.registerResource(
    'history-recent',
    'gms://history/recent',
    {
      title: 'Recent History',
      description: 'Recent sync and manual operation history',
      mimeType: 'application/json',
    },
    async uri => createJsonResourceContents(uri.toString(), await services.listRecentHistoryResource()),
  );

  server.registerResource(
    'history-run-details',
    new ResourceTemplate('gms://history/runs/{runId}', { list: undefined }),
    {
      title: 'History Run Details',
      description: 'Detailed history run with ordered events',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const runId = getSingleVariable(variables.runId);
      return createJsonResourceContents(uri.toString(), await services.getHistoryRunResource({ runId }));
    },
  );
}

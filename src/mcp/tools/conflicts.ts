import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConflictMcpServices } from '../contracts';
import { createJsonTextContent, createOkResult, formatCountMessage } from '../helpers';

export function registerConflictTools(server: McpServer, services: ConflictMcpServices) {
  server.registerTool(
    'conflicts.list',
    {
      title: 'List Open Conflicts',
      description: 'Return the current open mapping conflicts',
      inputSchema: {},
    },
    async () => {
      const data = await services.listOpenMappingConflictsResource();
      const result = createOkResult(
        formatCountMessage(data.count, 'open mapping conflict'),
        data,
      );

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );
}

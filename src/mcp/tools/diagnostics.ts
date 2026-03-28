import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DiagnosticsMcpServices } from '../contracts';
import { createJsonTextContent, createOkResult } from '../helpers';

export function registerDiagnosticTools(server: McpServer, services: DiagnosticsMcpServices) {
  server.registerTool(
    'diagnostics.explain_product_state',
    {
      title: 'Explain Product State',
      description: 'Explain the current cross-system state of one product reference',
      inputSchema: {
        productRef: z.string().trim().min(1),
      },
    },
    async ({ productRef }) => {
      const data = await services.explainProductState({ productRef });
      const result = createOkResult('Explained the current product state.', data);

      return {
        content: [createJsonTextContent(result)],
        structuredContent: result,
      };
    },
  );
}

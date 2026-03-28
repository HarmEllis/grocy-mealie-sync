import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createMcpHttpHandler } from '../http';

describe('MCP prompts', () => {
  it('lists the operational prompt templates and resolves prompt content', async () => {
    const handleRequest = createMcpHttpHandler();
    const client = new Client(
      { name: 'mcp-prompts-test-client', version: '1.0.0' },
      { capabilities: {} },
    );

    const transport = new StreamableHTTPClientTransport(
      new URL('http://localhost/api/mcp'),
      {
        fetch: async (input, init) => handleRequest(
          input instanceof Request ? input : new Request(input, init),
        ),
      },
    );

    try {
      await client.connect(transport);

      const prompts = await client.listPrompts();
      expect(prompts.prompts.map(prompt => prompt.name)).toEqual(expect.arrayContaining([
        'create-new-product',
        'review-unmapped-items',
        'diagnose-product-state',
        'process-shopping-fix',
        'apply-stock-correction',
      ]));

      const diagnosticPrompt = await client.getPrompt({
        name: 'diagnose-product-state',
        arguments: {
          productRef: 'grocy:101',
        },
      });

      expect(diagnosticPrompt.messages).toHaveLength(1);
      expect(diagnosticPrompt.messages[0]).toMatchObject({
        role: 'user',
        content: {
          type: 'text',
        },
      });

      expect(
        diagnosticPrompt.messages[0].content.type === 'text'
          ? diagnosticPrompt.messages[0].content.text
          : '',
      ).toContain('diagnostics.explain_product_state');
      expect(
        diagnosticPrompt.messages[0].content.type === 'text'
          ? diagnosticPrompt.messages[0].content.text
          : '',
      ).toContain('products.get_overview');
    } finally {
      await Promise.allSettled([client.close(), transport.close()]);
    }
  });
});

import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { GrocyMealieSyncMcpServices } from './contracts';
import { createGrocyMealieSyncMcpServer } from './server';

function createMethodNotAllowedResponse(): Response {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      Allow: 'POST',
    },
  });
}

export function createMcpHttpHandler(
  overrides: Partial<GrocyMealieSyncMcpServices> = {},
): (request: Request) => Promise<Response> {
  return async function handleMcpHttpRequest(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return createMethodNotAllowedResponse();
    }

    const server = createGrocyMealieSyncMcpServer(overrides);
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
      sessionIdGenerator: undefined,
    });

    try {
      await server.connect(transport);
      return await transport.handleRequest(request);
    } finally {
      await Promise.allSettled([
        transport.close(),
        server.close(),
      ]);
    }
  };
}

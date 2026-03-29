import { config } from '@/lib/config';
import { createMcpHttpHandler } from '@/mcp/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handleMcpRequest = createMcpHttpHandler();

function createMcpDisabledResponse() {
  return new Response('MCP server is disabled. Set MCP_ENABLED=true to enable /api/mcp.', {
    status: 503,
  });
}

export async function GET(request: Request) {
  if (!config.mcpEnabled) {
    return createMcpDisabledResponse();
  }

  return handleMcpRequest(request);
}

export async function POST(request: Request) {
  if (!config.mcpEnabled) {
    return createMcpDisabledResponse();
  }

  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  if (!config.mcpEnabled) {
    return createMcpDisabledResponse();
  }

  return handleMcpRequest(request);
}

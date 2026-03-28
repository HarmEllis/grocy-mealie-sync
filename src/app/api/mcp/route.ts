import { createMcpHttpHandler } from '@/mcp/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handleMcpRequest = createMcpHttpHandler();

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}

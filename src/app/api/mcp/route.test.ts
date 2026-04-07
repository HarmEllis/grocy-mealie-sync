import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  mcpEnabled: false,
  handleMcpRequest: vi.fn(async () => new Response('ok', { status: 200 })),
}));

vi.mock('@/lib/config', () => ({
  config: {
    get mcpEnabled() {
      return mockState.mcpEnabled;
    },
  },
}));

vi.mock('@/mcp/http', () => ({
  createMcpHttpHandler: vi.fn(() => mockState.handleMcpRequest),
}));

import { DELETE, GET, POST } from './route';

describe('mcp route', () => {
  beforeEach(() => {
    mockState.mcpEnabled = false;
    mockState.handleMcpRequest.mockReset();
    mockState.handleMcpRequest.mockResolvedValue(new Response('ok', { status: 200 }));
  });

  it('returns 503 when mcp is disabled', async () => {
    const response = await POST(new Request('http://localhost/api/mcp', {
      method: 'POST',
      body: '{}',
    }));

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('MCP server is disabled. Set MCP_ENABLED=true to enable /api/mcp.');
    expect(mockState.handleMcpRequest).not.toHaveBeenCalled();
  });

  it('returns 503 for non-post requests when mcp is disabled', async () => {
    const response = await GET(new Request('http://localhost/api/mcp', {
      method: 'GET',
    }));

    expect(response.status).toBe(503);
    expect(mockState.handleMcpRequest).not.toHaveBeenCalled();
  });

  it('returns 503 for delete requests when mcp is disabled', async () => {
    const response = await DELETE(new Request('http://localhost/api/mcp', {
      method: 'DELETE',
    }));

    expect(response.status).toBe(503);
    expect(mockState.handleMcpRequest).not.toHaveBeenCalled();
  });

  it('delegates to the mcp handler when mcp is enabled', async () => {
    mockState.mcpEnabled = true;
    const request = new Request('http://localhost/api/mcp', {
      method: 'POST',
      body: '{}',
    });

    const response = await POST(request);

    expect(mockState.handleMcpRequest).toHaveBeenCalledWith(request);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
  });

  it('delegates delete requests to the mcp handler when mcp is enabled', async () => {
    mockState.mcpEnabled = true;
    const request = new Request('http://localhost/api/mcp', {
      method: 'DELETE',
    });

    const response = await DELETE(request);

    expect(mockState.handleMcpRequest).toHaveBeenCalledWith(request);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
  });
});

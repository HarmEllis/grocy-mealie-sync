import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../server', async () => {
  const actual = await vi.importActual<typeof import('../server')>('../server');
  return {
    ...actual,
    createGrocyMealieSyncMcpServer: vi.fn(actual.createGrocyMealieSyncMcpServer),
  };
});

import { createGrocyMealieSyncMcpServer } from '../server';
import { createMcpHttpHandler } from '../http';

function createInitializeRequest(): Request {
  return new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: {
          name: 'mcp-http-session-test-client',
          version: '1.0.0',
        },
      },
    }),
  });
}

function createListToolsRequest(sessionId: string, id: number): Request {
  return new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      'mcp-session-id': sessionId,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'tools/list',
      params: {},
    }),
  });
}

function createDeleteRequest(sessionId: string): Request {
  return new Request('http://localhost/api/mcp', {
    method: 'DELETE',
    headers: {
      'mcp-session-id': sessionId,
    },
  });
}

describe('MCP streamable HTTP session lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('reuses one server instance for repeated requests in the same session', async () => {
    const createServerMock = vi.mocked(createGrocyMealieSyncMcpServer);
    const handleRequest = createMcpHttpHandler({}, {
      sessionTtlMs: 900_000,
      maxSessions: 10,
      sweepIntervalMs: 60_000,
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    const firstInitResponse = await handleRequest(createInitializeRequest());
    const firstSessionId = firstInitResponse.headers.get('mcp-session-id');
    expect(firstInitResponse.status).toBe(200);
    expect(firstSessionId).toBeTruthy();

    const firstToolsResponse = await handleRequest(createListToolsRequest(firstSessionId!, 2));
    const secondToolsResponse = await handleRequest(createListToolsRequest(firstSessionId!, 3));
    expect(firstToolsResponse.status).toBe(200);
    expect(secondToolsResponse.status).toBe(200);
    expect(createServerMock).toHaveBeenCalledTimes(1);

    const secondInitResponse = await handleRequest(createInitializeRequest());
    const secondSessionId = secondInitResponse.headers.get('mcp-session-id');
    expect(secondInitResponse.status).toBe(200);
    expect(secondSessionId).toBeTruthy();
    expect(secondSessionId).not.toBe(firstSessionId);
    expect(createServerMock).toHaveBeenCalledTimes(2);

    await handleRequest(createDeleteRequest(firstSessionId!));
    await handleRequest(createDeleteRequest(secondSessionId!));
  });

  it('enforces max sessions and allows new initialization after a slot is freed', async () => {
    const handleRequest = createMcpHttpHandler({}, {
      sessionTtlMs: 900_000,
      maxSessions: 2,
      sweepIntervalMs: 60_000,
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    const firstInit = await handleRequest(createInitializeRequest());
    const secondInit = await handleRequest(createInitializeRequest());
    const firstSessionId = firstInit.headers.get('mcp-session-id');
    const secondSessionId = secondInit.headers.get('mcp-session-id');

    expect(firstInit.status).toBe(200);
    expect(secondInit.status).toBe(200);
    expect(firstSessionId).toBeTruthy();
    expect(secondSessionId).toBeTruthy();

    const capacityResponse = await handleRequest(createInitializeRequest());
    expect(capacityResponse.status).toBe(503);
    await expect(capacityResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Service Unavailable: Maximum MCP sessions reached (2).',
      },
      id: null,
    });

    const deleteResponse = await handleRequest(createDeleteRequest(firstSessionId!));
    expect(deleteResponse.status).toBe(200);

    const recoveredInit = await handleRequest(createInitializeRequest());
    const recoveredSessionId = recoveredInit.headers.get('mcp-session-id');
    expect(recoveredInit.status).toBe(200);
    expect(recoveredSessionId).toBeTruthy();

    await handleRequest(createDeleteRequest(secondSessionId!));
    await handleRequest(createDeleteRequest(recoveredSessionId!));
  });

  it('expires inactive sessions via the background sweep timer', async () => {
    vi.useFakeTimers();

    const handleRequest = createMcpHttpHandler({}, {
      sessionTtlMs: 60_000,
      maxSessions: 10,
      sweepIntervalMs: 30_000,
      now: () => Date.now(),
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    const initResponse = await handleRequest(createInitializeRequest());
    const sessionId = initResponse.headers.get('mcp-session-id');
    expect(initResponse.status).toBe(200);
    expect(sessionId).toBeTruthy();

    await vi.advanceTimersByTimeAsync(91_000);

    const staleSessionResponse = await handleRequest(createListToolsRequest(sessionId!, 2));
    expect(staleSessionResponse.status).toBe(404);
    await expect(staleSessionResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Session not found',
      },
      id: null,
    });
  });
});

import { config } from '@/lib/config';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JSONRPCMessageSchema, isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { GrocyMealieSyncMcpServiceOverrides } from './contracts';
import { createGrocyMealieSyncMcpServer } from './server';

type McpTransport = WebStandardStreamableHTTPServerTransport;

type SessionEntry = {
  server: McpServer;
  transport: McpTransport;
  lastSeenAt: number;
  isDisposing: boolean;
  disposePromise: Promise<void> | null;
};

type McpHttpHandlerOptions = {
  sessionTtlMs?: number;
  maxSessions?: number;
  sweepIntervalMs?: number;
  now?: () => number;
  sessionIdGenerator?: () => string;
};

function createMethodNotAllowedResponse(): Response {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      Allow: 'GET, POST, DELETE',
    },
  });
}

function createJsonRpcErrorResponse(status: number, code: number, message: string): Response {
  return new Response(JSON.stringify({
    jsonrpc: '2.0',
    error: { code, message },
    id: null,
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function createMissingSessionHeaderResponse(): Response {
  return createJsonRpcErrorResponse(400, -32000, 'Bad Request: Mcp-Session-Id header is required');
}

function createSessionNotFoundResponse(): Response {
  return createJsonRpcErrorResponse(404, -32001, 'Session not found');
}

function createSessionCapacityResponse(maxSessions: number): Response {
  return createJsonRpcErrorResponse(
    503,
    -32000,
    `Service Unavailable: Maximum MCP sessions reached (${maxSessions}).`,
  );
}

async function parseJsonRpcMessagesFromRequest(
  request: Request,
): Promise<{
  parsedBody: unknown;
  messages: Array<Parameters<typeof isInitializeRequest>[0]>;
} | { response: Response }> {
  let parsedBody: unknown;
  try {
    parsedBody = await request.clone().json();
  } catch {
    return {
      response: createJsonRpcErrorResponse(400, -32700, 'Parse error: Invalid JSON'),
    };
  }

  try {
    if (Array.isArray(parsedBody)) {
      return {
        parsedBody,
        messages: parsedBody.map(message => JSONRPCMessageSchema.parse(message)),
      };
    }

    return {
      parsedBody,
      messages: [JSONRPCMessageSchema.parse(parsedBody)],
    };
  } catch {
    return {
      response: createJsonRpcErrorResponse(400, -32700, 'Parse error: Invalid JSON-RPC message'),
    };
  }
}

function maybeUnrefTimer(timer: ReturnType<typeof setInterval>) {
  if (typeof timer === 'object' && timer !== null && 'unref' in timer && typeof timer.unref === 'function') {
    timer.unref();
  }
}

export function createMcpHttpHandler(
  overrides: GrocyMealieSyncMcpServiceOverrides = {},
  options: McpHttpHandlerOptions = {},
): (request: Request) => Promise<Response> {
  const sessionTtlMs = options.sessionTtlMs ?? config.mcpSessionTtlMs;
  const maxSessions = options.maxSessions ?? config.mcpMaxSessions;
  const sweepIntervalMs = options.sweepIntervalMs ?? Math.max(30_000, Math.floor(sessionTtlMs / 2));
  const now = options.now ?? (() => Date.now());
  const sessionIdGenerator = options.sessionIdGenerator ?? (() => crypto.randomUUID());

  const sessions = new Map<string, SessionEntry>();
  let sweepTimer: ReturnType<typeof setInterval> | null = null;
  let pendingInitializations = 0;

  // Returns an idempotent release function. Each call site gets its own closure
  // so double-release from both onsessioninitialized and the finally block is safe.
  function createReservationRelease(): () => void {
    let released = false;
    return function releaseReservationOnce() {
      if (!released) {
        released = true;
        pendingInitializations -= 1;
      }
    };
  }

  function stopSweepTimerIfIdle() {
    // Keep the timer alive while reservations are pending: they will become
    // active sessions imminently and would otherwise restart the timer immediately.
    if (sessions.size === 0 && pendingInitializations === 0 && sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }
  }

  function startSweepTimerIfNeeded() {
    if (sweepTimer || sessions.size === 0) {
      return;
    }

    // An O(n) sweep is cheap with the configured session cap.
    sweepTimer = setInterval(() => {
      void sweepExpiredSessions();
    }, sweepIntervalMs);
    maybeUnrefTimer(sweepTimer);
  }

  async function disposeSession(sessionId: string, entry: SessionEntry, closeTransport: boolean): Promise<void> {
    if (entry.isDisposing) {
      return entry.disposePromise ?? Promise.resolve();
    }

    entry.isDisposing = true;

    const disposePromise = (async () => {
      if (sessions.get(sessionId) === entry) {
        sessions.delete(sessionId);
      }
      stopSweepTimerIfIdle();

      const tasks: Promise<unknown>[] = [
        entry.server.close(),
      ];
      if (closeTransport) {
        tasks.unshift(entry.transport.close());
      }

      await Promise.allSettled(tasks);
    })();

    entry.disposePromise = disposePromise;
    return entry.disposePromise;
  }

  async function sweepExpiredSessions() {
    if (sessions.size === 0) {
      stopSweepTimerIfIdle();
      return;
    }

    const expirationThreshold = now() - sessionTtlMs;
    const disposals: Promise<void>[] = [];

    for (const [sessionId, entry] of sessions.entries()) {
      if (entry.lastSeenAt < expirationThreshold) {
        disposals.push(disposeSession(sessionId, entry, true));
      }
    }

    await Promise.all(disposals);
  }

  async function createSessionForInitializeRequest(
    request: Request,
    parsedBody: unknown,
    onReservationConsumed: () => void,
  ): Promise<Response> {
    const server = createGrocyMealieSyncMcpServer(overrides);
    let initializedSessionId: string | null = null;

    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
      sessionIdGenerator,
      onsessioninitialized: (sessionId) => {
        initializedSessionId = sessionId;
        const entry: SessionEntry = {
          server,
          transport,
          lastSeenAt: now(),
          isDisposing: false,
          disposePromise: null,
        };

        transport.onclose = () => {
          void disposeSession(sessionId, entry, false);
        };

        sessions.set(sessionId, entry);
        // Reservation is now a live session; release the pending slot.
        onReservationConsumed();
        startSweepTimerIfNeeded();
      },
    });

    await server.connect(transport);

    const response = await transport.handleRequest(request, { parsedBody });

    if (!initializedSessionId) {
      await Promise.allSettled([
        transport.close(),
        server.close(),
      ]);
    }

    return response;
  }

  return async function handleMcpHttpRequest(request: Request): Promise<Response> {
    if (request.method !== 'POST' && request.method !== 'GET' && request.method !== 'DELETE') {
      return createMethodNotAllowedResponse();
    }

    await sweepExpiredSessions();
    const sessionId = request.headers.get('mcp-session-id');

    if (sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        return createSessionNotFoundResponse();
      }

      session.lastSeenAt = now();
      const response = await session.transport.handleRequest(request);

      if (request.method === 'DELETE' && response.status === 200) {
        await disposeSession(sessionId, session, false);
      }

      return response;
    }

    if (request.method !== 'POST') {
      return createMissingSessionHeaderResponse();
    }

    const parsedBodyResult = await parseJsonRpcMessagesFromRequest(request);
    if ('response' in parsedBodyResult) {
      return parsedBodyResult.response;
    }

    const hasInitializeRequest = parsedBodyResult.messages.some(message => isInitializeRequest(message));
    if (!hasInitializeRequest) {
      return createMissingSessionHeaderResponse();
    }

    await sweepExpiredSessions();
    if (sessions.size + pendingInitializations >= maxSessions) {
      return createSessionCapacityResponse(maxSessions);
    }
    // Reserve capacity atomically (no await between check and increment).
    pendingInitializations += 1;
    const releaseReservationOnce = createReservationRelease();

    try {
      return await createSessionForInitializeRequest(request, parsedBodyResult.parsedBody, releaseReservationOnce);
    } finally {
      // No-op if onsessioninitialized already called releaseReservationOnce.
      // Fires on any failure path (thrown error, transport refusing init, etc.).
      releaseReservationOnce();
    }
  };
}

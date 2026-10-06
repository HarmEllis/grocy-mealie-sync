import { randomUUID } from 'crypto';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';
import { z } from 'zod';
import {
  CLOSE_CODES,
  DEFAULT_REQUEST_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
  HELLO_TIMEOUT_MS,
  MAX_FRAME_BYTES,
  MAX_IN_FLIGHT_REQUESTS,
  PLUGIN_CONNECT_PATH,
  PLUGIN_SUBPROTOCOL,
  PROTOCOL_VERSION,
  envelopeSchema,
  helloParamsSchema,
  isPluginEvent,
  pluginEvents,
  pluginMethods,
  type HelloParams,
  type PluginError,
  type PluginEvent,
  type PluginEventData,
  type PluginMethod,
  type PluginMethodParams,
  type PluginMethodResult,
  type ResponseEnvelope,
} from './protocol/v1';

/** Error raised for a failed core-to-plugin call. `outcome` tells whether the retailer may have changed. */
export class PluginCallError extends Error {
  readonly code: PluginError['code'] | 'NOT_CONNECTED' | 'BAD_RESPONSE';
  readonly outcome: PluginError['outcome'];
  readonly retryable: boolean;

  constructor(code: PluginCallError['code'], message: string, outcome: PluginError['outcome'], retryable: boolean) {
    super(message);
    this.name = 'PluginCallError';
    this.code = code;
    this.outcome = outcome;
    this.retryable = retryable;
  }
}

export interface AuthenticatedInstallation {
  id: string;
}

export interface GatewayDeps {
  authenticate: (token: string) => AuthenticatedInstallation | null | Promise<AuthenticatedInstallation | null>;
  /** Sessions are only accepted while this process owns the scheduler (and therefore runs the shop workers). */
  isSchedulerActive: () => boolean;
  onHello: (installationId: string, hello: HelloParams) => { ok: true } | { ok: false; reason: string };
  onSessionReady?: (session: PluginSessionInfo) => void;
  onSessionClosed?: (session: PluginSessionInfo, code: number) => void;
  onEvent?: <E extends PluginEvent>(session: PluginSessionInfo, event: E, data: PluginEventData<E>) => void;
  coreVersion: string;
  log?: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void };
  /** Failed handshakes per remote address and window before throttling kicks in. */
  maxFailedHandshakes?: number;
  failedHandshakeWindowMs?: number;
  heartbeatIntervalMs?: number;
  helloTimeoutMs?: number;
}

export interface PluginSessionInfo {
  sessionId: string;
  installationId: string;
  hello: HelloParams;
  connectedAt: Date;
}

interface PendingCall {
  method: PluginMethod;
  resolve: (value: unknown) => void;
  reject: (error: PluginCallError) => void;
  timer: ReturnType<typeof setTimeout>;
}

class PluginSession {
  readonly sessionId = randomUUID();
  readonly connectedAt = new Date();
  hello: HelloParams | null = null;
  alive = true;
  closed = false;
  private readonly pending = new Map<string, PendingCall>();
  private readonly waiters: Array<() => void> = [];
  private reservedSlots = 0;
  pluginRequestsInFlight = 0;

  constructor(readonly ws: WebSocket, readonly installationId: string) {}

  get info(): PluginSessionInfo {
    return { sessionId: this.sessionId, installationId: this.installationId, hello: this.hello!, connectedAt: this.connectedAt };
  }

  send(payload: unknown): void {
    if (this.ws.readyState !== this.ws.OPEN) return;
    try {
      this.ws.send(JSON.stringify(payload), () => {});
    } catch {
      // The close handler settles everything that depends on this session.
    }
  }

  private async acquireSlot(): Promise<void> {
    while (this.reservedSlots >= MAX_IN_FLIGHT_REQUESTS) {
      await new Promise<void>(resolve => this.waiters.push(resolve));
      if (this.closed) throw new PluginCallError('NOT_CONNECTED', 'Plugin session closed', 'not_applied', true);
    }
    if (this.closed) throw new PluginCallError('NOT_CONNECTED', 'Plugin session closed', 'not_applied', true);
    // Reserve before yielding; simultaneous callers have not populated pending yet.
    this.reservedSlots++;
  }

  private releaseSlot(): void {
    this.reservedSlots--;
    this.waiters.shift()?.();
  }

  async call<M extends PluginMethod>(method: M, params: PluginMethodParams<M>, timeoutMs: number): Promise<PluginMethodResult<M>> {
    const definition = pluginMethods[method];
    const capability = definition.capability as string;
    if (!this.hello?.capabilities.includes(capability as never)) {
      throw new PluginCallError('NOT_SUPPORTED', `Plugin does not offer the "${capability}" capability`, 'not_applied', false);
    }
    const validated = definition.params.parse(params);
    await this.acquireSlot();
    if (this.closed) {
      this.releaseSlot();
      throw new PluginCallError('NOT_CONNECTED', 'Plugin session closed', 'not_applied', true);
    }
    if (this.ws.readyState !== this.ws.OPEN) {
      // Nothing was sent, so the retailer cannot have changed.
      this.releaseSlot();
      throw new PluginCallError('NOT_CONNECTED', 'Plugin session is not open', 'not_applied', true);
    }
    const id = randomUUID();
    return new Promise<PluginMethodResult<M>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.releaseSlot();
        reject(new PluginCallError('TIMEOUT', `Plugin did not answer ${method} in time`, 'unknown', true));
      }, timeoutMs);
      this.pending.set(id, {
        method,
        resolve: value => resolve(value as PluginMethodResult<M>),
        reject,
        timer,
      });
      const settleSendFailure = (error: unknown) => {
        const entry = this.pending.get(id);
        if (!entry) return;
        this.pending.delete(id);
        clearTimeout(entry.timer);
        this.releaseSlot();
        // A failed write may still have delivered part of the frame; treat it as uncertain.
        reject(new PluginCallError('NOT_CONNECTED', `Sending ${method} failed: ${error instanceof Error ? error.message : String(error)}`, 'unknown', true));
      };
      try {
        this.ws.send(JSON.stringify({ v: PROTOCOL_VERSION, kind: 'req', id, method, params: validated }), (error) => {
          if (error) settleSendFailure(error);
        });
      } catch (error) {
        settleSendFailure(error);
      }
    });
  }

  handleResponse(envelope: ResponseEnvelope): void {
    const pending = this.pending.get(envelope.id);
    if (!pending) return;
    this.pending.delete(envelope.id);
    clearTimeout(pending.timer);
    this.releaseSlot();
    if (!envelope.ok) {
      const error = envelope.error;
      pending.reject(new PluginCallError(error.code, error.message, error.outcome, error.retryable));
      return;
    }
    const parsed = pluginMethods[pending.method].result.safeParse(envelope.result);
    if (!parsed.success) {
      pending.reject(new PluginCallError(
        'BAD_RESPONSE',
        `Plugin returned an invalid ${pending.method} result: ${z.prettifyError(parsed.error).slice(0, 500)}`,
        'unknown',
        false,
      ));
      return;
    }
    pending.resolve(parsed.data);
  }

  failPending(reason: string): void {
    this.closed = true;
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      // The request may have reached the plugin before the connection dropped.
      pending.reject(new PluginCallError('NOT_CONNECTED', reason, 'unknown', true));
      this.pending.delete(id);
      this.releaseSlot();
    }
    while (this.waiters.length > 0) this.waiters.shift()?.();
  }
}

export interface PluginGateway {
  handleUpgrade: (req: IncomingMessage, socket: Duplex, head: Buffer) => void;
  closeAll: (code?: number, reason?: string) => Promise<void>;
  closeInstallation: (installationId: string, code: number, reason: string) => void;
  getSession: (installationId: string) => PluginSessionInfo | null;
  listSessions: () => PluginSessionInfo[];
  call: <M extends PluginMethod>(
    installationId: string,
    method: M,
    params: PluginMethodParams<M>,
    options?: { timeoutMs?: number },
  ) => Promise<PluginMethodResult<M>>;
  dispose: () => void;
}

function writeHttpError(socket: Duplex, status: string, message: string, headers: Record<string, string> = {}): void {
  if (socket.destroyed) return;
  const body = JSON.stringify({ error: message });
  const lines = [
    `HTTP/1.1 ${status}`,
    'Content-Type: application/json',
    `Content-Length: ${Buffer.byteLength(body)}`,
    'Connection: close',
    ...Object.entries(headers).map(([key, value]) => `${key}: ${value}`),
  ];
  socket.end(`${lines.join('\r\n')}\r\n\r\n${body}`);
}

function bearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, value, ...rest] = header.split(' ');
  return scheme === 'Bearer' && value && rest.length === 0 ? value : null;
}

function rawDataToString(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  return data.toString('utf8');
}

export function createPluginGateway(deps: GatewayDeps): PluginGateway {
  const log = deps.log ?? { info: () => {}, warn: () => {} };
  const maxFailures = deps.maxFailedHandshakes ?? 10;
  const failureWindowMs = deps.failedHandshakeWindowMs ?? 60_000;
  const helloTimeoutMs = deps.helloTimeoutMs ?? HELLO_TIMEOUT_MS;
  const failures = new Map<string, { count: number; windowEndsAt: number }>();
  const sessions = new Map<string, PluginSession>();
  const allSockets = new Set<PluginSession>();

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_FRAME_BYTES,
    perMessageDeflate: false,
    handleProtocols: protocols => (protocols.has(PLUGIN_SUBPROTOCOL) ? PLUGIN_SUBPROTOCOL : false),
  });

  function remoteAddress(req: IncomingMessage): string {
    return req.socket.remoteAddress ?? 'unknown';
  }

  function throttled(address: string): number | null {
    const entry = failures.get(address);
    if (!entry) return null;
    const now = Date.now();
    if (now > entry.windowEndsAt) {
      failures.delete(address);
      return null;
    }
    return entry.count >= maxFailures ? Math.ceil((entry.windowEndsAt - now) / 1000) : null;
  }

  function recordFailure(address: string): void {
    const now = Date.now();
    const entry = failures.get(address);
    if (!entry || now > entry.windowEndsAt) {
      failures.set(address, { count: 1, windowEndsAt: now + failureWindowMs });
    } else {
      entry.count++;
    }
  }

  /** Run a callback (sync or async) so that its errors are logged, never thrown into ws internals. */
  function safely(callback: () => unknown, label: string): void {
    try {
      const result = callback();
      if (result && typeof (result as Promise<unknown>).catch === 'function') {
        (result as Promise<unknown>).catch(error => log.warn(`[Plugins] ${label} handler failed:`, error));
      }
    } catch (error) {
      log.warn(`[Plugins] ${label} handler failed:`, error);
    }
  }

  const heartbeat = setInterval(() => {
    const schedulerActive = deps.isSchedulerActive();
    for (const session of allSockets) {
      if (!schedulerActive) {
        session.ws.close(CLOSE_CODES.serviceRestart, 'Scheduler is not active on this instance');
        continue;
      }
      if (!session.alive) {
        session.ws.terminate();
        continue;
      }
      session.alive = false;
      session.ws.ping();
    }
    const now = Date.now();
    for (const [address, entry] of failures) {
      if (now > entry.windowEndsAt) failures.delete(address);
    }
  }, deps.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS);
  heartbeat.unref?.();

  function sendError(session: PluginSession, id: string, code: PluginError['code'], message: string): void {
    session.send({
      v: PROTOCOL_VERSION,
      kind: 'res',
      id,
      ok: false,
      error: { code, message, retryable: false, outcome: 'not_applied' },
    });
  }

  function handleHello(session: PluginSession, id: string, params: unknown): void {
    if (session.hello) {
      sendError(session, id, 'BAD_REQUEST', 'hello was already sent');
      return;
    }
    const parsed = helloParamsSchema.safeParse(params);
    if (!parsed.success) {
      sendError(session, id, 'BAD_REQUEST', `Invalid hello: ${z.prettifyError(parsed.error).slice(0, 500)}`);
      session.ws.close(CLOSE_CODES.helloRejected, 'Invalid hello');
      return;
    }
    if (!parsed.data.protocolVersions.includes(PROTOCOL_VERSION)) {
      sendError(session, id, 'NOT_SUPPORTED', `Core speaks protocol version ${PROTOCOL_VERSION}`);
      session.ws.close(CLOSE_CODES.unsupportedVersion, 'Unsupported protocol version');
      return;
    }
    const accepted = deps.onHello(session.installationId, parsed.data);
    if (!accepted.ok) {
      sendError(session, id, 'BAD_REQUEST', accepted.reason);
      session.ws.close(CLOSE_CODES.providerMismatch, accepted.reason.slice(0, 120));
      return;
    }
    session.hello = parsed.data;
    const previous = sessions.get(session.installationId);
    if (previous && previous !== session) {
      log.info(`[Plugins] Installation ${session.installationId} reconnected; closing the previous session`);
      previous.ws.close(CLOSE_CODES.superseded, 'Superseded by a newer session');
    }
    sessions.set(session.installationId, session);
    session.send({
      v: PROTOCOL_VERSION,
      kind: 'res',
      id,
      ok: true,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        sessionId: session.sessionId,
        installationId: session.installationId,
        coreVersion: deps.coreVersion,
      },
    });
    log.info(`[Plugins] ${parsed.data.pluginName} ${parsed.data.pluginVersion} (${parsed.data.providerId}) connected as installation ${session.installationId}`);
    safely(() => deps.onSessionReady?.(session.info), 'onSessionReady');
  }

  function handleMessage(session: PluginSession, data: RawData, isBinary: boolean): void {
    if (isBinary) {
      session.ws.close(CLOSE_CODES.invalidPayload, 'Binary frames are not supported');
      return;
    }
    let json: unknown;
    try {
      json = JSON.parse(rawDataToString(data));
    } catch {
      session.ws.close(CLOSE_CODES.invalidPayload, 'Invalid JSON');
      return;
    }
    const parsed = envelopeSchema.safeParse(json);
    if (!parsed.success) {
      session.ws.close(CLOSE_CODES.protocolError, 'Invalid envelope');
      return;
    }
    const envelope = parsed.data;
    if (envelope.kind === 'req') {
      if (envelope.method === 'hello') {
        handleHello(session, envelope.id, envelope.params);
        return;
      }
      if (!session.hello) {
        sendError(session, envelope.id, 'BAD_REQUEST', 'Send hello first');
        return;
      }
      if (session.pluginRequestsInFlight >= MAX_IN_FLIGHT_REQUESTS) {
        session.send({
          v: PROTOCOL_VERSION, kind: 'res', id: envelope.id, ok: false,
          error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests in flight', retryable: true, outcome: 'not_applied' },
        });
        return;
      }
      sendError(session, envelope.id, 'NOT_SUPPORTED', `Unknown core method "${envelope.method}"`);
      return;
    }
    if (!session.hello) {
      session.ws.close(CLOSE_CODES.protocolError, 'Send hello first');
      return;
    }
    if (envelope.kind === 'res') {
      session.handleResponse(envelope);
      return;
    }
    if (!isPluginEvent(envelope.event)) {
      log.warn(`[Plugins] Ignoring unknown event "${envelope.event}" from installation ${session.installationId}`);
      return;
    }
    const eventData = pluginEvents[envelope.event].safeParse(envelope.data);
    if (!eventData.success) {
      log.warn(`[Plugins] Ignoring invalid "${envelope.event}" event from installation ${session.installationId}`);
      return;
    }
    safely(() => deps.onEvent?.(session.info, envelope.event as PluginEvent, eventData.data as never), `event ${envelope.event}`);
  }

  function onConnection(ws: WebSocket, installationId: string): void {
    const session = new PluginSession(ws, installationId);
    allSockets.add(session);
    const helloTimer = setTimeout(() => {
      if (!session.hello) ws.close(CLOSE_CODES.helloTimeout, 'hello not received in time');
    }, helloTimeoutMs);

    ws.on('pong', () => {
      session.alive = true;
    });
    ws.on('message', (data, isBinary) => {
      try {
        handleMessage(session, data, isBinary);
      } catch (error) {
        // Never let a handler error escape the socket listener and crash the process.
        log.warn(`[Plugins] Failed to handle a message from installation ${installationId}:`, error);
        ws.close(CLOSE_CODES.protocolError, 'Internal error handling message');
      }
    });
    ws.on('error', error => log.warn(`[Plugins] Session error for installation ${installationId}:`, error.message));
    ws.on('close', (code) => {
      clearTimeout(helloTimer);
      allSockets.delete(session);
      session.failPending('Plugin session closed');
      if (sessions.get(installationId) === session) {
        sessions.delete(installationId);
        log.info(`[Plugins] Installation ${installationId} disconnected (${code})`);
      }
      if (session.hello) safely(() => deps.onSessionClosed?.(session.info, code), 'onSessionClosed');
    });
  }

  async function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    const address = remoteAddress(req);
    try {
      const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
      if (pathname !== PLUGIN_CONNECT_PATH || req.method !== 'GET') {
        writeHttpError(socket, '404 Not Found', 'Not found');
        return;
      }
      const retryAfter = throttled(address);
      if (retryAfter !== null) {
        writeHttpError(socket, '429 Too Many Requests', 'Too many failed handshakes', { 'Retry-After': String(retryAfter) });
        return;
      }
      if (req.headers.origin) {
        // Browsers always send Origin; plugins never do. This blocks cross-site WebSocket hijacking.
        recordFailure(address);
        writeHttpError(socket, '403 Forbidden', 'Browser connections are not allowed');
        return;
      }
      const offered = (req.headers['sec-websocket-protocol'] ?? '').split(',').map(value => value.trim());
      if (!offered.includes(PLUGIN_SUBPROTOCOL)) {
        writeHttpError(socket, '400 Bad Request', `Missing subprotocol ${PLUGIN_SUBPROTOCOL}`);
        return;
      }
      const token = bearerToken(req);
      const installation = token ? await deps.authenticate(token) : null;
      if (!installation) {
        recordFailure(address);
        writeHttpError(socket, '401 Unauthorized', 'Invalid or revoked plugin token');
        return;
      }
      if (!deps.isSchedulerActive()) {
        writeHttpError(
          socket,
          '503 Service Unavailable',
          'This instance does not own the scheduler; shop plugins connect to the active instance only',
          { 'Retry-After': '30' },
        );
        return;
      }
      wss.handleUpgrade(req, socket, head, ws => onConnection(ws, installation.id));
    } catch (error) {
      log.warn('[Plugins] Handshake failed:', error);
      writeHttpError(socket, '500 Internal Server Error', 'Handshake failed');
    }
  }

  return {
    handleUpgrade: (req, socket, head) => {
      void handleUpgrade(req, socket, head);
    },
    closeAll: async (code = CLOSE_CODES.goingAway, reason = 'Closing') => {
      const closing = [...allSockets].map(session => new Promise<void>((resolve) => {
        if (session.ws.readyState === session.ws.CLOSED) {
          resolve();
          return;
        }
        const timer = setTimeout(() => {
          session.ws.terminate();
          resolve();
        }, 2_000);
        session.ws.once('close', () => {
          clearTimeout(timer);
          resolve();
        });
        session.ws.close(code, reason);
      }));
      await Promise.all(closing);
    },
    closeInstallation: (installationId, code, reason) => {
      for (const session of allSockets) {
        if (session.installationId === installationId) session.ws.close(code, reason);
      }
    },
    getSession: (installationId) => {
      const session = sessions.get(installationId);
      return session?.hello ? session.info : null;
    },
    listSessions: () => [...sessions.values()].filter(session => session.hello).map(session => session.info),
    call: async (installationId, method, params, options = {}) => {
      const session = sessions.get(installationId);
      if (!session?.hello) {
        throw new PluginCallError('NOT_CONNECTED', 'Plugin is not connected', 'not_applied', true);
      }
      return session.call(method, params, options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
    },
    dispose: () => {
      clearInterval(heartbeat);
      for (const session of allSockets) session.ws.terminate();
      wss.close();
    },
  };
}

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import {
  CLOSE_CODES, envelopeSchema, pluginEvents, HELLO_TIMEOUT_MS, helloParamsSchema, isPluginMethod,
  MAX_FRAME_BYTES, MAX_IN_FLIGHT_REQUESTS, PLUGIN_CONNECT_PATH, PLUGIN_SUBPROTOCOL, pluginMethods,
  PROTOCOL_VERSION, welcomeResultSchema,
  type HelloParams, type PluginEvent, type PluginEventData, type PluginMethod,
} from './protocol/v1.ts';
import { AdapterError } from './errors.ts';
import { OperationCache } from './operations.ts';

export interface ShopAdapter {
  getManifest(): HelloParams;
  handle(method: PluginMethod, params: unknown): Promise<unknown>;
}
export interface ClientOptions {
  url: string;
  token: string;
  dataDir: string;
  log?: (message: string) => void;
}

export function connectionUrl(base: string): URL {
  const url = new URL(base);
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('GM_SYNC_URL must be an HTTP(S) or WS(S) URL without credentials.');
  }
  url.protocol = ['https:', 'wss:'].includes(url.protocol) ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}${PLUGIN_CONNECT_PATH}`;
  url.search = '';
  url.hash = '';
  return url;
}

/** Outbound-only connector runtime. Store retailer credentials exclusively in the adapter's volume. */
export class PluginClient {
  private readonly adapter: ShopAdapter;
  private readonly options: ClientOptions;
  private readonly operations: OperationCache;
  private readonly url: URL;
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private stopped = false;
  private started = false;
  private reconnectAttempt = 0;
  private welcomed = false;

  constructor(adapter: ShopAdapter, options: ClientOptions) {
    if (!options.token) throw new Error('Configure GM_SYNC_PLUGIN_TOKEN.');
    this.adapter = adapter;
    this.options = options;
    this.url = connectionUrl(options.url);
    this.operations = new OperationCache(join(options.dataDir, 'protocol-operations'));
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await mkdir(this.options.dataDir, { recursive: true, mode: 0o700 });
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.welcomed = false;
    clearTimeout(this.reconnectTimer);
    this.socket?.close(CLOSE_CODES.normal, 'Shutting down');
    const current = this.socket;
    const timer = setTimeout(() => current?.terminate(), 5000);
    timer.unref();
  }

  notify<E extends PluginEvent>(event: E, data: PluginEventData<E>): void {
    if (!this.welcomed || !this.socket) return;
    const parsed = pluginEvents[event].parse(data);
    this.send(this.socket, { v: PROTOCOL_VERSION, kind: 'evt', event, data: parsed });
  }

  private log(message: string): void { (this.options.log ?? console.log)(`[Shop plugin] ${message}`); }
  private send(socket: WebSocket, frame: unknown): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    try { socket.send(JSON.stringify(frame), error => { if (error) socket.terminate(); }); }
    catch { socket.terminate(); }
  }

  private connect(): void {
    if (this.stopped) return;
    const socket = new WebSocket(this.url, PLUGIN_SUBPROTOCOL, {
      headers: { Authorization: `Bearer ${this.options.token}` }, maxPayload: MAX_FRAME_BYTES,
      handshakeTimeout: HELLO_TIMEOUT_MS, perMessageDeflate: false,
    });
    this.socket = socket;
    this.welcomed = false;
    let active = 0;
    const activeIds = new Set<string>();
    const helloId = randomUUID();
    let lastSeen = Date.now();
    const handshakeTimer = setTimeout(() => socket.terminate(), HELLO_TIMEOUT_MS);
    let healthTimer: NodeJS.Timeout | undefined;
    const writeHealth = () => {
      if (Date.now() - lastSeen > 90000) { socket.terminate(); return; }
      void writeFile(join(this.options.dataDir, 'heartbeat'), String(Date.now()), { mode: 0o600 }).catch(() => {});
    };
    socket.on('ping', () => { lastSeen = Date.now(); });
    socket.on('open', () => {
      let manifest: HelloParams;
      try { manifest = helloParamsSchema.parse(this.adapter.getManifest()); }
      catch { this.log('Adapter manifest is invalid.'); this.stopped = true; socket.close(CLOSE_CODES.invalidPayload); return; }
      this.send(socket, { v: PROTOCOL_VERSION, kind: 'req', id: helloId, method: 'hello', params: manifest });
    });
    socket.on('message', raw => {
      lastSeen = Date.now();
      let frame;
      try { frame = envelopeSchema.parse(JSON.parse(raw.toString())); }
      catch { socket.close(CLOSE_CODES.protocolError, 'Invalid protocol frame'); return; }
      if (!this.welcomed) {
        if (frame.kind !== 'res' || frame.id !== helloId || !frame.ok || (!welcomeResultSchema.safeParse(frame.result).success || (frame.result as { protocolVersion?: number }).protocolVersion !== PROTOCOL_VERSION)) {
          socket.close(CLOSE_CODES.helloRejected, 'Handshake rejected'); return;
        }
        this.welcomed = true;
        this.reconnectAttempt = 0;
        clearTimeout(handshakeTimer);
        this.log('Connected.');
        writeHealth();
        healthTimer = setInterval(writeHealth, 15000);
        return;
      }
      if (frame.kind !== 'req') return;
      const fail = (error: AdapterError) => this.send(socket, { v: PROTOCOL_VERSION, kind: 'res', id: frame.id, ok: false,
        error: { code: error.code, message: error.message, retryable: error.retryable, outcome: error.outcome } });
      if (!isPluginMethod(frame.method)) { fail(new AdapterError('NOT_SUPPORTED', 'Unknown method.')); return; }
      const method = frame.method;
      if (active >= MAX_IN_FLIGHT_REQUESTS || activeIds.has(frame.id)) { fail(new AdapterError('TOO_MANY_REQUESTS', 'Too many operations.', 'not_applied', true)); return; }
      const params = pluginMethods[method].params.safeParse(frame.params);
      if (!params.success) { fail(new AdapterError('BAD_REQUEST', 'Invalid operation parameters.')); return; }
      active++;
      activeIds.add(frame.id);
      void (async () => {
        try {
          const execute = () => this.adapter.handle(method, params.data);
          const manifest = this.adapter.getManifest();
          const result = method === 'list.apply'
            ? await this.operations.run(`${manifest.providerId}:${manifest.accountKey ?? 'anonymous'}`, pluginMethods['list.apply'].params.parse(params.data), execute)
            : await execute();
          const validated = pluginMethods[method].result.parse(result);
          this.send(socket, { v: PROTOCOL_VERSION, kind: 'res', id: frame.id, ok: true, result: validated });
          if (method.startsWith('auth.') && (validated as { kind?: string }).kind === 'done') {
            const current = this.adapter.getManifest();
            this.notify('auth.changed', { authState: current.authState, accountKey: current.accountKey, accountLabel: current.accountLabel });
          }
        } catch (error) {
          // Unknown errors are sanitized. Write failures are uncertain unless the adapter proves otherwise.
          fail(error instanceof AdapterError ? error : new AdapterError('INTERNAL', 'Operation failed; verify the adapter contract.', method === 'list.apply' ? 'unknown' : 'not_applied'));
        } finally { active--; activeIds.delete(frame.id); }
      })();
    });
    socket.on('unexpected-response', (_request, response) => {
      if (response.statusCode === 401 || response.statusCode === 403) {
        this.stopped = true;
        this.log('Installation token rejected. Configure a valid token and restart.');
      }
      response.resume();
      socket.terminate();
    });
    socket.on('error', () => {});
    socket.on('close', code => {
      clearTimeout(handshakeTimer);
      clearInterval(healthTimer);
      if (this.socket === socket) this.welcomed = false;
      if ([CLOSE_CODES.revoked, CLOSE_CODES.superseded, CLOSE_CODES.providerMismatch, CLOSE_CODES.unsupportedVersion].includes(code as never)) {
        this.stopped = true;
        this.log('Installation disabled or replaced; restart after correcting configuration.');
      }
      if (this.stopped) return;
      const cap = Math.min(300000, 1000 * 2 ** Math.min(this.reconnectAttempt++, 9));
      this.reconnectTimer = setTimeout(() => this.connect(), Math.max(1000, Math.random() * cap));
      this.log('Disconnected; reconnect scheduled.');
    });
  }
}

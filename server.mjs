// Custom Node server so Next.js and the shop plugin WebSocket gateway share one
// port. Next.js route handlers cannot accept WebSocket upgrades, so upgrades on
// PLUGIN_CONNECT_PATH are routed to the gateway that `instrumentation.ts`
// registers on `globalThis`. Everything else is served by Next.js unchanged.
//
// This file is not compiled by Next.js: keep it plain ESM that runs on the
// Node.js version pinned in package.json.

import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';

const PLUGIN_CONNECT_PATH = '/api/plugins/connect';
const SHUTDOWN_GRACE_MS = 10_000;
const DEV_INSTRUMENTATION_TIMEOUT_MS = 120_000;

function parseArgs(argv) {
  const options = { dev: false, port: undefined, hostname: undefined };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const [flag, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const takeValue = () => inlineValue ?? argv[++index];
    switch (flag) {
      case '--dev':
        options.dev = true;
        break;
      case '--port':
      case '-p':
        options.port = takeValue();
        break;
      case '--hostname':
      case '-H':
        options.hostname = takeValue();
        break;
      case '--turbopack':
      case '--turbo':
        // Accepted for compatibility with the previous `next dev --turbopack` script.
        break;
      default:
        console.warn(`[Server] Ignoring unknown argument "${arg}"`);
    }
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const dev = options.dev;
// NODE_ENV must be final before `next` is imported.
process.env.NODE_ENV = dev ? 'development' : 'production';

const port = Number.parseInt(options.port ?? process.env.PORT ?? '3000', 10);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`[Server] Invalid port "${options.port ?? process.env.PORT}"`);
  process.exit(1);
}
// Shells commonly export HOSTNAME as the machine name, so the env var is only
// honoured in production, where the Docker image sets it explicitly.
const listenHostname = options.hostname ?? (dev ? undefined : process.env.HOSTNAME) ?? undefined;

// Registered before Next.js loads: its dev server adds signal listeners of its
// own, which disable Node's default exit, so a signal during startup would
// otherwise leave the process running.
let httpServer = null;
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Server] ${signal} received, shutting down`);
  const forceExit = setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS);
  forceExit.unref();
  if (!httpServer?.listening) process.exit(0);
  try {
    await getGateway()?.closeAll(1001, 'Server shutting down');
  } catch (error) {
    console.error('[Server] Closing plugin sessions failed:', error);
  }
  httpServer.close(() => process.exit(0));
  httpServer.closeIdleConnections?.();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

const { default: next } = await import('next');

function pathnameOf(url) {
  try {
    return new URL(url ?? '/', 'http://localhost').pathname;
  } catch {
    return '';
  }
}

function getGateway() {
  return globalThis.__gmsPluginGateway;
}

function rejectUpgrade(socket, status, reason, extraHeaders = {}) {
  if (socket.destroyed) return;
  const body = JSON.stringify({ error: reason });
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    Connection: 'close',
    ...extraHeaders,
  };
  const head = Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join('\r\n');
  socket.end(`HTTP/1.1 ${status}\r\n${head}\r\n\r\n${body}`);
}

httpServer = createServer();
const app = next({ dev, hostname: listenHostname ?? 'localhost', port, httpServer, turbopack: dev });
const handle = app.getRequestHandler();

// Intercept upgrade events before any listener (including the one Next.js
// attaches lazily on its first request) sees them. Plugin upgrades never reach
// Next.js, and in production nothing else may upgrade.
const originalEmit = httpServer.emit.bind(httpServer);
httpServer.emit = (event, ...args) => {
  if (event !== 'upgrade') {
    return originalEmit(event, ...args);
  }

  const [req, socket, head] = args;
  socket.on('error', () => {});
  if (pathnameOf(req.url) === PLUGIN_CONNECT_PATH) {
    const gateway = getGateway();
    if (!gateway) {
      rejectUpgrade(socket, '503 Service Unavailable', 'Plugin gateway is not ready yet', { 'Retry-After': '5' });
      return true;
    }
    gateway.handleUpgrade(req, socket, head);
    return true;
  }

  if (dev) {
    // Development HMR uses its own WebSocket. Next.js attaches an upgrade
    // listener to the httpServer passed to next() on its first request (the
    // startup warm-up request makes that happen early).
    if (httpServer.listenerCount('upgrade') > 0) return originalEmit(event, ...args);
    rejectUpgrade(socket, '503 Service Unavailable', 'Development server is still starting', { 'Retry-After': '1' });
    return true;
  }

  rejectUpgrade(socket, '404 Not Found', 'Not found');
  return true;
};

httpServer.on('request', (req, res) => {
  if (pathnameOf(req.url) === PLUGIN_CONNECT_PATH) {
    res.writeHead(426, { 'Content-Type': 'application/json', Upgrade: 'websocket', Connection: 'Upgrade' });
    res.end(JSON.stringify({ error: 'This endpoint only accepts WebSocket upgrades from shop plugins' }));
    return;
  }
  handle(req, res).catch((error) => {
    console.error('[Server] Request handling failed:', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Internal Server Error');
    } else {
      res.destroy();
    }
  });
});

await app.prepare();

/**
 * Next.js registers instrumentation during prepare(). With a custom dev
 * server, Turbopack may not have written the compiled hook yet; Next.js then
 * caches "no instrumentation" for the life of the process and migrations, the
 * scheduler and the plugin gateway never start. In that case compile the hook
 * (any request triggers it) and call register(), which memoizes one shared
 * startup promise on globalThis, so startup never runs twice.
 */
async function ensureDevInstrumentation() {
  const deadline = Date.now() + DEV_INSTRUMENTATION_TIMEOUT_MS;
  const candidates = ['.next/dev/server/instrumentation.js', '.next/server/instrumentation.js']
    .map(file => path.join(process.cwd(), file));
  const require = createRequire(import.meta.url);
  while (Date.now() < deadline) {
    if (globalThis.__gmsInstrumentationPromise) return;
    // The health route answers 503 until startup finished; the request only compiles the hook.
    await fetch(`http://127.0.0.1:${port}/api/health`).catch(() => {});
    if (globalThis.__gmsInstrumentationPromise) return;
    const file = candidates.find(candidate => existsSync(candidate));
    if (file) {
      const loaded = require(file);
      const instrumentation = loaded?.default ?? loaded;
      if (typeof instrumentation?.register === 'function') {
        console.log('[Server] Running instrumentation that Next.js skipped during development startup');
        await instrumentation.register();
        return;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Instrumentation was not compiled in time');
}

/** Wait until migrations, the scheduler and the plugin gateway are up; a failed startup ends the process. */
async function awaitStartup() {
  if (dev) await ensureDevInstrumentation();
  await globalThis.__gmsInstrumentationPromise;
  if (!globalThis.__gmsInstrumentationReady) throw new Error('Instrumentation did not complete');
}

httpServer.listen(port, listenHostname, () => {
  const shownHost = listenHostname && listenHostname !== '0.0.0.0' ? listenHostname : 'localhost';
  console.log(`> Listening on http://${shownHost}:${port} (${dev ? 'development' : 'production'})`);
  awaitStartup()
    .then(() => console.log(`> Ready on http://${shownHost}:${port}`))
    .catch((error) => {
      console.error('[Server] Startup failed; exiting:', error);
      process.exit(1);
    });
});

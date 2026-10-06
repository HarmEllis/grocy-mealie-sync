// End-to-end check of the same-port shop plugin runtime with the public demo
// plugin from examples/shop-plugin-template.
//
//   node scripts/test-plugin-e2e.mjs --mode dev      # custom server in dev mode (HMR) + plugin process
//   node scripts/test-plugin-e2e.mjs --mode prod     # next build + custom server + plugin process
//   node scripts/test-plugin-e2e.mjs --mode docker   # both Docker images on a private network
//
// Grocy and Mealie are pointed at an unreachable address, so nothing outside
// this test is ever written. The app database lives in a throwaway file.

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';

const modeIndex = process.argv.indexOf('--mode');
const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : 'dev';
if (!['dev', 'prod', 'docker'].includes(mode)) throw new Error(`Unknown mode ${mode}`);

const root = path.resolve(import.meta.dirname, '..');
const templateDir = path.join(root, 'examples/shop-plugin-template');
const runId = randomUUID().slice(0, 8);
const pluginDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gms-plugin-e2e-data-'));
const dbFile = `plugin-e2e-${runId}.db`;
const cleanups = [];
const processes = [];

const isolatedEnv = {
  AUTH_ENABLED: 'false',
  GROCY_URL: 'http://127.0.0.1:1',
  GROCY_API_KEY: 'test-only',
  MEALIE_URL: 'http://127.0.0.1:1',
  MEALIE_API_TOKEN: 'test-only',
  MEALIE_SHOPPING_LIST_ID: '',
  HEALTHCHECKS_PING_URL: '',
  NOTIFICATION_WEBHOOK_URL: '',
  MCP_ENABLED: 'false',
  HISTORY_RETENTION_DAYS: '-1',
  POLL_INTERVAL_SECONDS: '15',
};

function log(message) {
  console.log(`[plugin-e2e:${mode}] ${message}`);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with ${result.status}`);
}

function startProcess(command, args, env, label) {
  const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const exited = new Promise(resolve => child.once('exit', code => resolve(code)));
  const entry = { child, exited, output: () => output, label };
  processes.push(entry);
  // Stop and wait, escalating to SIGKILL, so nothing keeps running after the test.
  cleanups.push(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    try { child.kill('SIGTERM'); } catch {}
    const stopped = await Promise.race([exited.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 15_000))]);
    if (!stopped) {
      try { process.kill(-child.pid, 'SIGKILL'); } catch {}
      await exited;
    }
  });
  return entry;
}

async function waitFor(probe, description, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await probe();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    // Gentle polling: the app limits API requests per client.
    await new Promise(resolve => setTimeout(resolve, 2_000));
  }
  throw new Error(`Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ''}`);
}

async function api(baseUrl, pathname, init = {}) {
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(`${baseUrl}${pathname}`, {
      ...init,
      headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status !== 429) break;
    // Respect the app's own request limiter instead of working around it.
    const waitSeconds = Number(response.headers.get('retry-after') ?? '60');
    await response.text();
    log(`API limiter asked to wait ${waitSeconds}s`);
    await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
  }
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${pathname} -> ${response.status}: ${text.slice(0, 300)}`);
  return body;
}

function upgradeStatus(url, headers = {}, protocols = []) {
  return new Promise((resolve) => {
    const socket = new WebSocket(url, protocols, { headers, handshakeTimeout: 10_000 });
    socket.on('open', () => { socket.terminate(); resolve(101); });
    socket.on('unexpected-response', (_request, response) => { response.resume(); resolve(response.statusCode); });
    socket.on('error', () => resolve(0));
  });
}

async function main() {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}`;
  const network = `gms-plugin-e2e-${runId}`;
  const coreContainer = `gms-core-e2e-${runId}`;
  const pluginContainer = `gms-plugin-e2e-${runId}`;
  let core;

  if (mode === 'docker') {
    log('Building images');
    run('docker', ['build', '-t', 'gms-core:plugin-e2e', '.']);
    run('docker', ['build', '-t', 'gms-shop-plugin-template:plugin-e2e', templateDir]);
    run('docker', ['network', 'create', network]);
    cleanups.push(() => spawnSync('docker', ['network', 'rm', network], { stdio: 'ignore' }));
    const envArgs = Object.entries(isolatedEnv).flatMap(([key, value]) => ['-e', `${key}=${value}`]);
    run('docker', ['run', '-d', '--name', coreContainer, '--network', network, '-p', `127.0.0.1:${port}:3000`, '--tmpfs', '/app/data:uid=1001,gid=1001', ...envArgs, 'gms-core:plugin-e2e']);
    cleanups.push(() => spawnSync('docker', ['rm', '-f', coreContainer], { stdio: 'ignore' }));
  } else {
    const env = { ...process.env, ...isolatedEnv, DATABASE_PATH: `./data/${dbFile}` };
    cleanups.push(async () => {
      // Removed twice: a just-exited server can still flush its file handles.
      for (let attempt = 0; attempt < 2; attempt++) {
        for (const suffix of ['', '-wal', '-shm']) fs.rmSync(path.join(root, 'data', `${dbFile}${suffix}`), { force: true });
        await new Promise(resolve => setTimeout(resolve, 1_000));
      }
    });
    if (mode === 'prod') {
      log('Building the app');
      run('npm', ['run', 'build'], { env });
      core = startProcess('node', ['server.mjs', '--hostname', '127.0.0.1', '--port', String(port)], env, 'core');
    } else {
      core = startProcess('node', ['server.mjs', '--dev', '--hostname', '127.0.0.1', '--port', String(port)], env, 'core');
    }
  }

  log(`Waiting for ${baseUrl}`);
  // /api/health answers 503 until migrations, the scheduler and the plugin gateway are up.
  await waitFor(async () => (await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(10_000) })).status === 200, 'startup to complete', 240_000);
  assert.ok((await fetch(`${baseUrl}/api/plugins/installations`)).ok, 'database routes work once healthy');

  // Same-port routing.
  const plain = await fetch(`${baseUrl}/api/plugins/connect`);
  assert.equal(plain.status, 426, 'plain requests to the plugin endpoint need an upgrade');
  assert.equal(await upgradeStatus(`${wsUrl}/api/plugins/connect`, {}, ['gms-plugin.v1']), 401, 'unauthenticated upgrade is refused');
  assert.equal(await upgradeStatus(`${wsUrl}/api/plugins/connect`, { Origin: 'https://example.invalid' }, ['gms-plugin.v1']), 403, 'browser upgrade is refused');
  // Browsers send a same-origin Origin header; Next.js blocks HMR upgrades without one.
  const hmrStatus = await upgradeStatus(`${wsUrl}/_next/hmr`, { Origin: baseUrl });
  if (mode === 'dev') assert.equal(hmrStatus, 101, 'development HMR WebSocket still works on the same port');
  else assert.equal(hmrStatus, 404, 'production refuses other upgrades');
  assert.ok((await fetch(`${baseUrl}/shopping`)).ok, 'the Shopping page renders');
  log('Same-port routing verified');

  // Installation token and plugin connection.
  const created = await api(baseUrl, '/api/plugins/installations', { method: 'POST', body: JSON.stringify({ name: 'Demo shop' }) });
  assert.match(created.token, /^gmsp_[a-f0-9]{24}_/);
  const installationId = created.installation.id;
  const listed = await api(baseUrl, '/api/plugins/installations');
  assert.ok(!JSON.stringify(listed).includes(created.token), 'the token is never returned again');

  // Plugin data lives in a directory (process modes) or a named volume (Docker),
  // written as the plugin's own non-root user so the container can use it.
  const pluginVolume = `gms-plugin-e2e-data-${runId}`;
  const writeFixture = (content) => {
    if (mode !== 'docker') {
      fs.writeFileSync(path.join(pluginDataDir, 'receipts.json'), content);
      return;
    }
    const result = spawnSync('docker', ['run', '--rm', '-i', '--network', 'none', '--entrypoint', 'sh', '-v', `${pluginVolume}:/data`,
      'gms-shop-plugin-template:plugin-e2e', '-c', 'cat > /data/receipts.json'], { input: content, stdio: ['pipe', 'inherit', 'inherit'] });
    if (result.status !== 0) throw new Error('Writing the receipt fixture into the plugin volume failed');
  };
  if (mode === 'docker') {
    run('docker', ['volume', 'create', pluginVolume]);
    cleanups.push(() => spawnSync('docker', ['volume', 'rm', '-f', pluginVolume], { stdio: 'ignore' }));
  }
  // No receipts yet; the fixture is written after receipt processing is enabled.
  writeFixture('[]');

  if (mode === 'docker') {
    run('docker', ['run', '-d', '--name', pluginContainer, '--network', network,
      '-e', `GM_SYNC_URL=http://${coreContainer}:3000`, '-e', `GM_SYNC_PLUGIN_TOKEN=${created.token}`,
      '-e', 'PLUGIN_DATA_DIR=/data', '-e', 'DEMO_AUTHENTICATED=true', '-v', `${pluginVolume}:/data`,
      'gms-shop-plugin-template:plugin-e2e']);
    cleanups.push(() => spawnSync('docker', ['rm', '-f', pluginContainer], { stdio: 'ignore' }));
  } else {
    startProcess('node', [path.join(templateDir, 'src/main.ts')], {
      PATH: process.env.PATH,
      GM_SYNC_URL: baseUrl,
      GM_SYNC_PLUGIN_TOKEN: created.token,
      PLUGIN_DATA_DIR: pluginDataDir,
      DEMO_AUTHENTICATED: 'true',
    }, 'plugin');
  }

  const connected = await waitFor(async () => {
    const data = await api(baseUrl, '/api/plugins/installations');
    return data.installations.find(entry => entry.id === installationId && entry.connected);
  }, 'the plugin to connect');
  assert.equal(connected.providerId, 'demo-shop');
  assert.deepEqual([...connected.capabilities].sort(), ['auth', 'catalog', 'list', 'receipts']);
  log('Plugin connected');

  // Declarative sign-in relay.
  const begin = await api(baseUrl, `/api/plugins/installations/${installationId}/auth`, { method: 'POST', body: JSON.stringify({ action: 'begin' }) });
  assert.equal(begin.step.kind, 'form');
  assert.ok(begin.step.fields.some(field => field.secret), 'secret fields are marked');

  // Catalogue search feeds central retailer mappings.
  const search = await api(baseUrl, `/api/plugins/installations/${installationId}/catalog?query=milk`);
  assert.deepEqual(search.products.map(product => product.id), ['demo-milk']);
  await api(baseUrl, '/api/shop/mappings', { method: 'POST', body: JSON.stringify({
    providerId: 'demo-shop', retailerProductId: 'demo-milk', targetKind: 'mealie_food', targetId: 'food-e2e',
    targetName: 'Milk', role: 'preferred', baseUnitId: null, baseUnitName: 'piece', packageBaseAmount: 1, confirm: true,
  }) });
  const mappings = await api(baseUrl, '/api/shop/mappings?providerId=demo-shop');
  assert.equal(mappings.mappings[0].confirmed, true);

  // Receipts: enabling moves the activation boundary to now; then core pulls durably.
  await api(baseUrl, `/api/plugins/installations/${installationId}`, { method: 'PATCH', body: JSON.stringify({ settings: { receiptsEnabled: true, listSyncEnabled: true } }) });
  // Bought after the activation boundary that enabling just set.
  writeFixture(JSON.stringify([{
    receiptId: `e2e-${runId}`,
    purchasedAt: new Date().toISOString(),
    lines: [
      { lineNo: 1, kind: 'product', retailerProductId: 'demo-milk', description: 'Demo milk', quantity: 2, unit: 'st', amountCents: 238 },
      { lineNo: 2, kind: 'deposit', description: 'Deposit', quantity: 1, unit: 'st', amountCents: 15 },
    ],
  }]));
  await api(baseUrl, '/api/shop/receipts/pull', { method: 'POST', body: JSON.stringify({ installationId }) });
  const stored = await waitFor(async () => {
    const overview = await api(baseUrl, '/api/shop/overview');
    return overview.receipts.find(receipt => receipt.externalReceiptId === `e2e-${runId}`);
  }, 'the receipt to be stored', 60_000);
  assert.deepEqual(stored.lines.map(line => line.kind), ['product', 'deposit']);
  log(`Receipt stored with status ${stored.status}`);

  // Revocation disconnects the plugin and the token stops working.
  await api(baseUrl, `/api/plugins/installations/${installationId}`, { method: 'DELETE' });
  await waitFor(async () => {
    const data = await api(baseUrl, '/api/plugins/installations');
    return !data.installations.some(entry => entry.id === installationId);
  }, 'the revoked installation to disappear');
  assert.equal(await upgradeStatus(`${wsUrl}/api/plugins/connect`, { Authorization: `Bearer ${created.token}` }, ['gms-plugin.v1']), 401);
  log('Revocation verified');

  if (core) {
    core.child.kill('SIGTERM');
    const exitCode = await Promise.race([core.exited, new Promise(resolve => setTimeout(() => resolve('timeout'), 15_000))]);
    assert.equal(exitCode, 0, 'the server exits cleanly on SIGTERM');
    log('Server stopped cleanly on SIGTERM');
  }
  log('All checks passed');
}

try {
  await main();
} catch (error) {
  console.error(error);
  for (const entry of processes) {
    console.error(`----- ${entry.label} output (last 8000 characters) -----`);
    console.error(entry.output().slice(-8000));
  }
  if (mode === 'docker') {
    spawnSync('docker', ['logs', '--tail', '200', `gms-core-e2e-${runId}`], { stdio: 'inherit' });
    spawnSync('docker', ['logs', '--tail', '100', `gms-plugin-e2e-${runId}`], { stdio: 'inherit' });
  }
  process.exitCode = 1;
} finally {
  for (const cleanup of cleanups.reverse()) {
    try { await cleanup(); } catch {}
  }
  fs.rmSync(pluginDataDir, { recursive: true, force: true });
}

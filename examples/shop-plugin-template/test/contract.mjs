import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { WebSocketServer } from 'ws';
import { DemoAdapter } from '../src/demo.ts';
import { PluginClient, connectionUrl } from '../lib/client.ts';
import { OperationCache } from '../lib/operations.ts';
import { AdapterError } from '../lib/errors.ts';
import { pluginMethods } from '../lib/protocol/v1.ts';

const params = { opId: 'synthetic-operation', listId: 'demo-list', ops: [{ op: 'add', retailerProductId: 'demo-milk', quantity: 2 }] };
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'gms-template-test-'));
  return { directory, adapter: await new DemoAdapter(directory, true).init(), cleanup: () => rm(directory, { recursive: true, force: true }) };
}
test('connection URL uses the existing host and port and preserves a base path', () => {
  assert.equal(connectionUrl('https://example.test:8443/gms/').href, 'wss://example.test:8443/gms/api/plugins/connect');
  assert.throws(() => connectionUrl('https://user:secret@example.test'));
  assert.throws(() => connectionUrl('file:///data'));
});
test('catalogue and list results follow the public contract', async () => {
  const current = await fixture();
  try {
    const catalogue = pluginMethods['catalog.search'].result.parse(await current.adapter.handle('catalog.search', { query: 'milk' }));
    assert.equal(catalogue.products[0].id, 'demo-milk');
    const cache = new OperationCache(join(current.directory, 'operations'));
    const result = await cache.run('demo-account', params, () => current.adapter.handle('list.apply', params));
    assert.equal(result.results[0].status, 'applied');
    assert.equal(result.list.lines[0].quantity, 2);
    const restarted = new OperationCache(join(current.directory, 'operations'));
    assert.deepEqual(await restarted.run('demo-account', params, () => { throw new Error('Must not repeat'); }), result);
    await assert.rejects(restarted.run('demo-account', { ...params, ops: [{ ...params.ops[0], quantity: 3 }] }, async () => ({})), /different contents/);
  } finally { await current.cleanup(); }
});
test('durable cache refuses to replay an interrupted write', async () => {
  const current = await fixture();
  try {
    const cache = new OperationCache(join(current.directory, 'operations'));
    let calls = 0;
    await assert.rejects(cache.run('demo-account', params, async () => { calls++; throw new Error('Synthetic interruption'); }));
    const restarted = new OperationCache(join(current.directory, 'operations'));
    await assert.rejects(restarted.run('demo-account', params, async () => { calls++; return {}; }), error => error instanceof AdapterError && error.outcome === 'unknown');
    assert.equal(calls, 1);
  } finally { await current.cleanup(); }
});
test('partial confirmation cannot clear durable write intent', async () => {
  const current = await fixture();
  try {
    const cache = new OperationCache(join(current.directory, 'operations'));
    await assert.rejects(cache.run('demo-account', params, async () => ({ opId: params.opId, results: [], list: { listId: 'demo-list', lines: [] } })), error => error.outcome === 'unknown');
    await assert.rejects(cache.run('demo-account', params, async () => ({})), error => error.outcome === 'unknown');
  } finally { await current.cleanup(); }
});
test('synthetic receipt fixtures are validated and discoverable without a web server', async () => {
  const current = await fixture();
  try {
    const receipt = { receiptId: 'synthetic-receipt', purchasedAt: '2026-10-06T12:00:00Z', lines: [{ lineNo: 1, kind: 'product', retailerProductId: 'demo-milk', description: 'Milk', quantity: 1, unit: 'piece', amountCents: 150 }] };
    await writeFile(join(current.directory, 'receipts.json'), JSON.stringify([receipt]));
    const result = pluginMethods['receipts.list'].result.parse(await current.adapter.handle('receipts.list', { since: '2026-10-06T00:00:00Z' }));
    assert.equal(result.receipts[0].lineCount, 1);
    assert.deepEqual(pluginMethods['receipts.get'].result.parse(await current.adapter.handle('receipts.get', { receiptId: receipt.receiptId })), receipt);
    await writeFile(join(current.directory, 'receipts.json'), '[]');
    assert.deepEqual((await current.adapter.handle('receipts.list', { since: '2026-10-06T00:00:00Z' })).receipts, []);
  } finally { await current.cleanup(); }
});
test('runtime authenticates outbound, rejects invalid input and dispatches bidirectionally', { timeout: 10000 }, async () => {
  const current = await fixture();
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  let client;
  let socket;
  try {
    const connected = once(server, 'connection');
    client = new PluginClient(current.adapter, { url: `http://127.0.0.1:${server.address().port}`, token: 'synthetic-installation-token', dataDir: current.directory, log: () => {} });
    await client.start();
    const [connection, request] = await connected;
    socket = connection;
    assert.equal(request.url, '/api/plugins/connect');
    assert.equal(request.headers.authorization, 'Bearer synthetic-installation-token');
    const [helloRaw] = await once(socket, 'message');
    const hello = JSON.parse(helloRaw.toString());
    assert.equal(hello.params.providerId, 'demo-shop');
    socket.send(JSON.stringify({ v: 1, kind: 'res', id: hello.id, ok: true, result: { protocolVersion: 1, sessionId: 'session', installationId: 'installation', coreVersion: 'test' } }));
    const exchange = async frame => {
      const reply = once(socket, 'message');
      socket.send(JSON.stringify(frame));
      const [raw] = await reply;
      return JSON.parse(raw.toString());
    };
    const catalogue = await exchange({ v: 1, kind: 'req', id: 'catalogue', method: 'catalog.search', params: { query: 'rice' } });
    assert.equal(catalogue.result.products[0].id, 'demo-rice');
    const rejected = await exchange({ v: 1, kind: 'req', id: 'invalid', method: 'list.apply', params: { ...params, ops: [{ ...params.ops[0], quantity: -1 }] } });
    assert.equal(rejected.error.code, 'BAD_REQUEST');
    assert.equal(rejected.error.outcome, 'not_applied');
    const applied = await exchange({ v: 1, kind: 'req', id: 'apply', method: 'list.apply', params });
    assert.equal(applied.result.list.lines[0].quantity, 2);
    assert.ok(Number(await readFile(join(current.directory, 'heartbeat'), 'utf8')) > 0);
  } finally {
    client?.stop();
    socket?.terminate();
    await new Promise(resolve => server.close(resolve));
    await current.cleanup();
  }
});


test('list writes cannot restore authentication after a concurrent logout', async () => {
  const current = await fixture();
  try {
    await Promise.all([current.adapter.handle('list.apply', params), current.adapter.handle('auth.logout', {})]);
    const restarted = await new DemoAdapter(current.directory, true).init();
    assert.equal(restarted.getManifest().authState, 'unauthenticated');
  } finally { await current.cleanup(); }
});

import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';
import { createPluginGateway, type PluginGateway } from '../gateway';
import { PLUGIN_SUBPROTOCOL, type RequestEnvelope } from '../protocol/v1';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { while (cleanup.length) await cleanup.pop()!(); });

async function connected(): Promise<{ client: WebSocket; gateway: PluginGateway; received: RequestEnvelope[] }> {
  const gateway = createPluginGateway({
    authenticate: () => ({ id: 'test-installation' }), isSchedulerActive: () => true,
    onHello: () => ({ ok: true }), coreVersion: 'test',
  });
  const server: Server = createServer();
  server.on('upgrade', gateway.handleUpgrade);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP address');
  const client = new WebSocket(`ws://127.0.0.1:${address.port}/api/plugins/connect`, PLUGIN_SUBPROTOCOL, { headers: { Authorization: 'Bearer synthetic-token' } });
  cleanup.push(async () => {
    client.terminate(); gateway.dispose();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  await once(client, 'open');
  const welcome = once(client, 'message');
  client.send(JSON.stringify({ v: 1, kind: 'req', id: 'hello', method: 'hello', params: {
    pluginName: 'Synthetic test', pluginVersion: '1', providerId: 'fake-shop', providerLabel: 'Fake',
    accountKey: 'synthetic-account', accountLabel: 'Test', protocolVersions: [1], capabilities: ['catalog', 'list'], authState: 'authenticated',
  } }));
  await welcome;
  const received: RequestEnvelope[] = [];
  client.on('message', raw => {
    const message = JSON.parse(raw.toString());
    if (message.kind === 'req') received.push(message);
  });
  return { client, gateway, received };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for gateway');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

describe('plugin gateway concurrent requests', () => {
  it('reserves slots before yielding so simultaneous calls never exceed the limit', async () => {
    const { client, gateway, received } = await connected();
    const calls = Array.from({ length: 12 }, (_, index) => gateway.call('test-installation', 'catalog.search', { query: `product-${index}` }));
    await waitFor(() => received.length >= 8);
    await new Promise(resolve => setTimeout(resolve, 30));
    const initialCount = received.length;
    for (const request of received.slice(0, 8)) client.send(JSON.stringify({ v: 1, kind: 'res', id: request.id, ok: true, result: { products: [] } }));
    await waitFor(() => received.length === 12);
    for (const request of received.slice(8)) client.send(JSON.stringify({ v: 1, kind: 'res', id: request.id, ok: true, result: { products: [] } }));
    await Promise.all(calls);
    expect(initialCount).toBe(8);
  });

  it('distinguishes a sent mutation from queued calls when the session drops', async () => {
    const { client, gateway, received } = await connected();
    const calls = Array.from({ length: 12 }, () => gateway.call('test-installation', 'list.read', {}));
    const settled = Promise.allSettled(calls);
    await waitFor(() => received.length >= 8);
    client.terminate();
    const results = await settled;
    const errors = results.map(result => result.status === 'rejected' ? result.reason.outcome : 'unexpected-success');
    expect(errors.filter(outcome => outcome === 'unknown')).toHaveLength(8);
    expect(errors.filter(outcome => outcome === 'not_applied')).toHaveLength(4);
  });
});

import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import { createServer, type Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { createTestDb } = await import('@/test-utils/test-db');
  return { db: createTestDb() };
});

import { createPluginGateway, type PluginGateway } from '../gateway';
import {
  authenticatePluginToken,
  createInstallation,
  getInstallation,
  recordAuthChanged,
  recordHello,
  revokeInstallation,
  updateInstallationSettings,
} from '../installations';
import { CLOSE_CODES, PLUGIN_SUBPROTOCOL, type PluginAuthState, type Receipt } from '../protocol/v1';
import { ensureLedgerActivated } from '@/lib/shop/ledger';
import { syncInstallationList } from '@/lib/shop/list-sync';
import { persistExports } from '@/lib/shop/projection';
import { listReceipts, pullReceipts } from '@/lib/shop/receipts';

const TEMPLATE_MAIN = path.resolve(__dirname, '../../../../examples/shop-plugin-template/src/main.ts');

let server: Server;
let gateway: PluginGateway;
let port: number;
let schedulerActive = true;
const children: ChildProcess[] = [];
const tempDirs: string[] = [];

beforeAll(async () => {
  gateway = createPluginGateway({
    coreVersion: 'test',
    authenticate: token => authenticatePluginToken(token),
    isSchedulerActive: () => schedulerActive,
    onHello: (installationId, hello) => {
      const result = recordHello(installationId, hello);
      return result.ok ? { ok: true } : { ok: false, reason: result.reason };
    },
    onEvent: (session, event, data) => {
      if (event === 'auth.changed') recordAuthChanged(session.installationId, data as { authState: PluginAuthState; accountKey: string | null; accountLabel: string | null });
    },
    heartbeatIntervalMs: 200,
    maxFailedHandshakes: 5,
  });
  server = createServer((_req, res) => { res.statusCode = 404; res.end(); });
  server.on('upgrade', (req, socket, head) => gateway.handleUpgrade(req, socket, head));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no address');
  port = address.port;
});

afterEach(() => {
  schedulerActive = true;
  for (const child of children.splice(0)) child.kill('SIGTERM');
});

afterAll(async () => {
  gateway.dispose();
  await new Promise<void>(resolve => server.close(() => resolve()));
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

async function rawHandshake(headers: Record<string, string>): Promise<{ status: number; retryAfter: string | null }> {
  const { request } = await import('node:http');
  return new Promise((resolve, reject) => {
    const req = request({
      host: '127.0.0.1', port, path: '/api/plugins/connect',
      headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==', ...headers },
    });
    req.on('response', response => {
      resolve({ status: response.statusCode ?? 0, retryAfter: response.headers['retry-after'] as string | null ?? null });
      response.resume();
    });
    req.on('upgrade', (response, socket) => {
      socket.destroy();
      resolve({ status: response.statusCode ?? 101, retryAfter: null });
    });
    req.on('error', reject);
    req.end();
  });
}

function startTemplate(token: string, receipts: Receipt[] = []): string {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gms-plugin-e2e-'));
  tempDirs.push(dataDir);
  fs.writeFileSync(path.join(dataDir, 'receipts.json'), JSON.stringify(receipts));
  const child = spawn(process.execPath, [TEMPLATE_MAIN], {
    // A minimal environment: the plugin only ever sees its own settings.
    env: { PATH: process.env.PATH ?? '', GM_SYNC_URL: `http://127.0.0.1:${port}`, GM_SYNC_PLUGIN_TOKEN: token, PLUGIN_DATA_DIR: dataDir, DEMO_AUTHENTICATED: 'true' } as unknown as NodeJS.ProcessEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', chunk => { output += chunk; });
  child.stderr?.on('data', chunk => { output += chunk; });
  child.on('exit', code => { if (code && code !== 0 && code !== 143) console.error(`template exited ${code}: ${output}`); });
  children.push(child);
  return dataDir;
}

async function waitFor<T>(probe: () => T | null | undefined | false, timeoutMs = 15_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = probe();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Timed out');
}

describe('plugin handshake', () => {
  it('rejects missing tokens, browsers and wrong subprotocols', async () => {
    const { token } = createInstallation('Handshake');
    expect((await rawHandshake({ 'Sec-WebSocket-Protocol': PLUGIN_SUBPROTOCOL })).status).toBe(401);
    expect((await rawHandshake({ 'Sec-WebSocket-Protocol': PLUGIN_SUBPROTOCOL, Authorization: `Bearer ${token}`, Origin: 'https://evil.example' })).status).toBe(403);
    expect((await rawHandshake({ Authorization: `Bearer ${token}` })).status).toBe(400);
    expect((await rawHandshake({ 'Sec-WebSocket-Protocol': PLUGIN_SUBPROTOCOL, Authorization: `Bearer ${token}` })).status).toBe(101);
  });

  it('refuses sessions on an instance that does not own the scheduler', async () => {
    const { token } = createInstallation('Passive');
    schedulerActive = false;
    const result = await rawHandshake({ 'Sec-WebSocket-Protocol': PLUGIN_SUBPROTOCOL, Authorization: `Bearer ${token}` });
    expect(result).toEqual({ status: 503, retryAfter: '30' });
  });

});

describe('template plugin end to end', () => {
  it('connects, relays sign-in, syncs the shared list and delivers receipts', async () => {
    ensureLedgerActivated(new Date('2026-01-01T00:00:00Z'));
    const { installation, token } = createInstallation('Demo shop');
    const receipt: Receipt = {
      receiptId: 'demo-receipt-1',
      purchasedAt: new Date().toISOString(),
      lines: [{ lineNo: 1, kind: 'product', retailerProductId: 'demo-milk', description: 'Demo milk', quantity: 2, unit: 'st', amountCents: 238 }],
    };
    startTemplate(token, [receipt]);

    const session = await waitFor(() => gateway.getSession(installation.id));
    expect(session.hello).toMatchObject({ providerId: 'demo-shop', capabilities: expect.arrayContaining(['list', 'receipts']) });
    expect(getInstallation(installation.id)).toMatchObject({ providerId: 'demo-shop', accountKey: 'demo-account-default' });

    const begin = await gateway.call(installation.id, 'auth.begin', {});
    expect(begin).toMatchObject({ kind: 'form', fields: expect.arrayContaining([expect.objectContaining({ name: 'code', secret: true })]) });
    await expect(gateway.call(installation.id, 'auth.submit', { stepId: begin.stepId, values: { account: 'other', code: 'demo' } }))
      .rejects.toMatchObject({ code: 'CONFLICT' });

    const search = await gateway.call(installation.id, 'catalog.search', { query: 'milk' });
    expect(search.products.map(product => product.id)).toEqual(['demo-milk']);

    persistExports(installation.id, 'demo-shop', [{
      retailerProductId: 'demo-milk', packages: 2, baseAmount: 2,
      allocations: [{ revisionId: 'rev', mealieItemId: 'row', targetKind: 'grocy_product', targetId: '1', baseAmount: 2, rowFactor: 1 }],
    }]);
    const listDeps = {
      readList: () => gateway.call(installation.id, 'list.read', {}),
      applyList: (params: Parameters<PluginGateway['call']>[2] & object) => gateway.call(installation.id, 'list.apply', params as never),
      now: () => new Date(),
    };
    expect(await syncInstallationList(installation.id, listDeps)).toMatchObject({ status: 'ok', applied: 1 });
    expect((await gateway.call(installation.id, 'list.read', {})).lines).toEqual([expect.objectContaining({ retailerProductId: 'demo-milk', quantity: 2 })]);
    expect(await syncInstallationList(installation.id, listDeps)).toMatchObject({ status: 'ok', applied: 0 });

    // Notes: advertised by the template, written and removed only by exact text.
    expect(session.hello.features).toContain('list.notes');
    const listId = (await gateway.call(installation.id, 'list.read', {})).listId;
    const note = await gateway.call(installation.id, 'list.apply', { opId: 'e2e-note-add', listId, ops: [{ op: 'add_note', text: 'Demo yoghurt — 500 g' }] });
    expect(note.results[0]).toMatchObject({ status: 'applied', lineId: expect.any(String) });
    const again = await gateway.call(installation.id, 'list.apply', { opId: 'e2e-note-again', listId, ops: [{ op: 'add_note', text: 'demo yoghurt — 500 G' }] });
    expect(again.results[0]).toMatchObject({ status: 'conflict', reason: 'note_exists' });
    const refused = await gateway.call(installation.id, 'list.apply', { opId: 'e2e-discontinued', listId, ops: [{ op: 'add', retailerProductId: 'demo-old-yoghurt', quantity: 1 }] });
    expect(refused.results[0]).toMatchObject({ status: 'failed', reason: 'product_discontinued' });
    const removed = await gateway.call(installation.id, 'list.apply', { opId: 'e2e-note-remove', listId, ops: [{ op: 'remove_note', lineId: note.results[0].lineId!, expectedText: 'Demo yoghurt — 500 g' }] });
    expect(removed.results[0].status).toBe('applied');
    const [detail] = (await gateway.call(installation.id, 'catalog.get', { ids: ['demo-old-yoghurt'] })).products;
    expect(detail.availability).toBe('discontinued');

    updateInstallationSettings(installation.id, { receiptsEnabled: true }, { now: new Date(Date.now() - 60_000) });
    const pull = await pullReceipts(getInstallation(installation.id)!, {
      listReceipts: params => gateway.call(installation.id, 'receipts.list', params),
      getReceipt: receiptId => gateway.call(installation.id, 'receipts.get', { receiptId }),
      now: () => new Date(),
    });
    expect(pull).toMatchObject({ status: 'ok', stored: 1 });
    expect(listReceipts().map(row => row.externalReceiptId)).toContain('demo-receipt-1');

    // Revocation closes the session; the old token can never reconnect.
    revokeInstallation(installation.id);
    gateway.closeInstallation(installation.id, CLOSE_CODES.revoked, 'revoked');
    await waitFor(() => gateway.getSession(installation.id) === null);
    expect((await rawHandshake({ 'Sec-WebSocket-Protocol': PLUGIN_SUBPROTOCOL, Authorization: `Bearer ${token}` })).status).toBe(401);
  }, 30_000);

  it('closes sessions when this instance stops owning the scheduler', async () => {
    const { installation, token } = createInstallation('Passive later');
    startTemplate(token);
    await waitFor(() => gateway.getSession(installation.id));
    schedulerActive = false;
    await waitFor(() => gateway.getSession(installation.id) === null);
  }, 30_000);
});

it('rejects note operations for a legacy list plugin before sending any retailer write', async () => {
  const { installation, token } = createInstallation('Legacy list feature test');
  const dataDir = startTemplate(token);
  const session = await waitFor(() => gateway.getSession(installation.id));
  // Emulate a protocol-v1 peer that never advertised the additive feature.
  delete session.hello.features;
  const list = await gateway.call(installation.id, 'list.read', {});
  await expect(gateway.call(installation.id, 'list.apply', { opId: 'legacy-note-add', listId: list.listId, ops: [{ op: 'add_note', text: 'Chicken — 500 g' }] }))
    .rejects.toMatchObject({ code: 'NOT_SUPPORTED', outcome: 'not_applied' });
  await expect(gateway.call(installation.id, 'list.apply', { opId: 'legacy-note-remove', listId: list.listId, ops: [{ op: 'remove_note', lineId: 'not-a-line', expectedText: 'Chicken — 500 g' }] }))
    .rejects.toMatchObject({ code: 'NOT_SUPPORTED', outcome: 'not_applied' });
  expect((await gateway.call(installation.id, 'list.read', {})).lines).toEqual([]);
  expect(fs.existsSync(path.join(dataDir, 'protocol-operations')) && fs.readdirSync(path.join(dataDir, 'protocol-operations')).length > 0).toBe(false);
}, 30_000);

// Runs last: throttling is per remote address and would block the plugin tests above.
describe('handshake throttling', () => {
  it('throttles repeated failed handshakes', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 8; attempt++) {
      statuses.push((await rawHandshake({ 'Sec-WebSocket-Protocol': PLUGIN_SUBPROTOCOL, Authorization: 'Bearer gmsp_000000000000000000000000_wrong' })).status);
    }
    expect(statuses.at(-1)).toBe(429);
  });
});

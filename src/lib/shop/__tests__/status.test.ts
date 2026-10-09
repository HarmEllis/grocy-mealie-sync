import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { createTestDb } = await import('@/test-utils/test-db');
  return { db: createTestDb() };
});
const runtime = vi.hoisted(() => ({ connected: true }));
vi.mock('@/lib/plugins/runtime', () => ({
  getPluginGateway: () => ({ getSession: () => runtime.connected ? { hello: { capabilities: ['receipts'] } } : null }),
}));

import { db } from '@/lib/db';
import { appMeta, pluginInstallations, receiptCursors, syncState } from '@/lib/db/schema';
import { createInstallation, recordHello, revokeInstallation, updateInstallationSettings } from '@/lib/plugins/installations';
import { getShopDashboardStatus, recordShopJob } from '../status';

const now = new Date('2026-10-09T10:00:00Z');
let id: string;
beforeEach(() => {
  for (const table of [appMeta, pluginInstallations, receiptCursors, syncState]) db.delete(table).run();
  runtime.connected = true;
  id = createInstallation('AH').installation.id;
  recordHello(id, { pluginName: 'AH', pluginVersion: 'test', providerId: 'ah', providerLabel: 'AH',
    accountKey: 'test-account', accountLabel: 'Test', protocolVersions: [1], capabilities: ['receipts'], authState: 'authenticated' });
  updateInstallationSettings(id, { receiptsEnabled: true });
});

it('ignores corrupt diagnostic snapshots without breaking dashboard status', () => {
  db.insert(appMeta).values({ key: `shop-list-status:${id}`, value: '{broken' }).run();
  db.insert(syncState).values({ id: 'shop:last-reconcile', stateData: 'null' }).run();
  expect(getShopDashboardStatus(true, now, new Date(now.getTime() + 60_000))).toMatchObject({ lastJob: null, receipts: [{ listSync: null }] });
});

it('removes installation diagnostics on revoke while preserving other installations', () => {
  const keys = [`shop-list-status:${id}`, `shop-projection-review:${id}`, `shop-note-preference:${id}:food`];
  db.insert(appMeta).values([...keys, 'shop-list-status:other'].map(key => ({ key, value: '{}' }))).run();
  revokeInstallation(id);
  expect(db.select().from(appMeta).all().map(row => row.key)).toEqual(['shop-list-status:other']);
});

it('shows the next check from the receipt cursor, including a failed attempt', () => {
  db.insert(receiptCursors).values({ id: `${id}:test-account`, installationId: id, accountKey: 'test-account',
    lastPullAt: now, lastError: 'Retailer unavailable' }).run();
  expect(getShopDashboardStatus(true, now, new Date(now.getTime() + 60_000))).toMatchObject({
    nextProcessingAt: '2026-10-09T10:01:00.000Z',
    receipts: [{ state: 'ready', lastCheckedAt: now.toISOString(), nextCheckAt: '2026-10-09T10:30:00.000Z', lastError: 'Retailer unavailable' }],
  });
});

it('shows a first pull or unfinished pagination as due now', () => {
  expect(getShopDashboardStatus(true, now, new Date(now.getTime() + 60_000)).receipts[0].nextCheckAt).toBe(now.toISOString());
  db.insert(receiptCursors).values({ id: `${id}:test-account`, installationId: id, accountKey: 'test-account', lastPullAt: now, pageCursor: 'page-2' }).run();
  expect(getShopDashboardStatus(true, now, new Date(now.getTime() + 60_000)).receipts[0].nextCheckAt).toBe(now.toISOString());
});

it('does not promise receipt checks while disabled, disconnected or passive', () => {
  runtime.connected = false;
  expect(getShopDashboardStatus(true, now, new Date(now.getTime() + 60_000)).receipts[0]).toMatchObject({ state: 'disconnected', nextCheckAt: null });
  runtime.connected = true;
  expect(getShopDashboardStatus(false, now)).toMatchObject({ nextProcessingAt: null, receipts: [{ state: 'disconnected', nextCheckAt: null }] });
  updateInstallationSettings(id, { receiptsEnabled: false });
  expect(getShopDashboardStatus(true, now, new Date(now.getTime() + 60_000)).receipts[0]).toMatchObject({ state: 'disabled', nextCheckAt: null });
});

it('persists the last processing result without replacing the core sync snapshot', () => {
  db.insert(syncState).values({ id: 'singleton', stateData: '{"lastGrocyPoll":"preserved"}' }).run();
  recordShopJob('failure', now);
  expect(getShopDashboardStatus(true, now, new Date(now.getTime() + 60_000)).lastJob).toEqual({ status: 'failure', finishedAt: now.toISOString() });
  expect(db.select().from(syncState).all().find(row => row.id === 'singleton')?.stateData).toBe('{"lastGrocyPoll":"preserved"}');
});

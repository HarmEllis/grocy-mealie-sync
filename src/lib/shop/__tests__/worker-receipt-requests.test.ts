import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { createTestDb } = await import('@/test-utils/test-db');
  return { db: createTestDb() };
});
const runtime = vi.hoisted(() => ({
  ids: [] as string[],
  pull: vi.fn(async (_installation: { id: string }, _deps: unknown) => ({ status: 'ok', stored: 0 })),
}));
vi.mock('@/lib/plugins/runtime', () => ({
  getPluginGateway: () => ({
    listSessions: () => runtime.ids.map(installationId => ({ installationId, hello: { capabilities: ['receipts'] } })),
    call: vi.fn(),
  }),
  setShopWorker: vi.fn(),
}));
vi.mock('../receipts', () => ({ isReceiptPullDue: () => false, pullReceipts: runtime.pull }));

import { db } from '@/lib/db';
import { pluginInstallations } from '@/lib/db/schema';
import { createInstallation, recordHello, updateInstallationSettings } from '@/lib/plugins/installations';
import { createShopWorker } from '../worker';

beforeEach(() => {
  db.delete(pluginInstallations).run();
  runtime.pull.mockClear();
  runtime.ids = ['First shop', 'Second shop'].map(name => {
    const id = createInstallation(name).installation.id;
    recordHello(id, { pluginName: name, pluginVersion: 'test', providerId: name, providerLabel: name,
      accountKey: 'synthetic', accountLabel: 'Test', protocolVersions: [1], capabilities: ['receipts'], authState: 'authenticated' });
    updateInstallationSettings(id, { receiptsEnabled: true });
    return id;
  });
});

it('forces a pull for every connected installation even when no periodic pull is due', async () => {
  const worker = createShopWorker();
  worker.requestReceiptPull();
  await worker.runNow();
  expect(runtime.pull.mock.calls.map(([installation]) => installation.id)).toEqual(runtime.ids);
});

it('keeps installation-specific requests scoped to the selected shop', async () => {
  const worker = createShopWorker();
  worker.requestReceiptPull(runtime.ids[1]);
  await worker.runNow();
  expect(runtime.pull).toHaveBeenCalledTimes(1);
  expect(runtime.pull).toHaveBeenCalledWith(expect.objectContaining({ id: runtime.ids[1] }), expect.any(Object));
});

it('does not force a pull for a shop with receipt processing disabled', async () => {
  updateInstallationSettings(runtime.ids[0], { receiptsEnabled: false });
  const worker = createShopWorker();
  worker.requestReceiptPull();
  await worker.runNow();
  expect(runtime.pull).toHaveBeenCalledTimes(1);
  expect(runtime.pull).toHaveBeenCalledWith(expect.objectContaining({ id: runtime.ids[1] }), expect.any(Object));
});

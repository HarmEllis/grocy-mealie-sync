import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  config: {
    healthchecksPingUrl: null as string | null,
    allowInsecureTls: false,
    notificationWebhookUrl: null as string | null,
    notificationWebhookMode: 'errors_only' as 'always' | 'errors_only',
  },
  logWarn: vi.fn(),
}));

vi.mock('../config', () => ({
  config: mockState.config,
}));

vi.mock('../logger', () => ({
  log: {
    warn: mockState.logWarn,
  },
}));

import {
  buildGenericWebhookPayload,
  buildHealthchecksBody,
  sendSchedulerNotifications,
  summarizeSchedulerCycle,
} from '../scheduler-notifications';

describe('scheduler notifications', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    mockState.config.healthchecksPingUrl = null;
    mockState.config.allowInsecureTls = false;
    mockState.config.notificationWebhookUrl = null;
    mockState.config.notificationWebhookMode = 'errors_only';
    mockState.logWarn.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('summarizes mixed scheduler runs as partial', () => {
    const summary = summarizeSchedulerCycle({
      cycleType: 'poll',
      startedAt: new Date('2026-03-27T10:00:00.000Z'),
      finishedAt: new Date('2026-03-27T10:00:30.000Z'),
      steps: [
        { name: 'mealie_to_grocy', status: 'success' },
        { name: 'grocy_to_mealie', status: 'failure', error: 'Boom' },
        { name: 'conflict_check', status: 'success' },
      ],
    });

    expect(summary.status).toBe('partial');
    expect(summary.durationMs).toBe(30_000);
  });

  it('builds a healthchecks body with successful and failed steps', () => {
    const body = buildHealthchecksBody({
      cycleType: 'poll',
      status: 'partial',
      startedAt: '2026-03-27T10:00:00.000Z',
      finishedAt: '2026-03-27T10:00:30.000Z',
      durationMs: 30_000,
      steps: [
        { name: 'mealie_to_grocy', status: 'success' },
        { name: 'grocy_to_mealie', status: 'failure', error: 'Shopping list missing' },
      ],
    });

    expect(body).toContain('Status: partial');
    expect(body).toContain('Succeeded: mealie_to_grocy');
    expect(body).toContain('Failed: grocy_to_mealie (Shopping list missing)');
  });

  it('builds a generic webhook payload', () => {
    expect(buildGenericWebhookPayload({
      cycleType: 'product_sync',
      status: 'success',
      startedAt: '2026-03-27T10:00:00.000Z',
      finishedAt: '2026-03-27T10:01:00.000Z',
      durationMs: 60_000,
      steps: [
        { name: 'product_sync', status: 'success' },
      ],
    })).toEqual({
      event: 'scheduler_cycle',
      cycleType: 'product_sync',
      status: 'success',
      startedAt: '2026-03-27T10:00:00.000Z',
      finishedAt: '2026-03-27T10:01:00.000Z',
      durationMs: 60_000,
      steps: [
        { name: 'product_sync', status: 'success' },
      ],
    });
  });

  it('posts to healthchecks fail and the generic webhook for partial runs', async () => {
    mockState.config.healthchecksPingUrl = 'https://hc-ping.test/abc123';
    mockState.config.notificationWebhookUrl = 'https://hooks.test/notify';
    mockState.config.notificationWebhookMode = 'errors_only';
    fetchMock.mockResolvedValue({ ok: true });

    await sendSchedulerNotifications({
      cycleType: 'poll',
      status: 'partial',
      startedAt: '2026-03-27T10:00:00.000Z',
      finishedAt: '2026-03-27T10:00:30.000Z',
      durationMs: 30_000,
      steps: [
        { name: 'mealie_to_grocy', status: 'success' },
        { name: 'grocy_to_mealie', status: 'failure', error: 'Boom' },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://hc-ping.test/abc123/fail',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://hooks.test/notify',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('passes an insecure dispatcher to healthchecks when configured', async () => {
    mockState.config.healthchecksPingUrl = 'https://hc-ping.test/abc123';
    mockState.config.allowInsecureTls = true;
    fetchMock.mockResolvedValue({ ok: true });

    await sendSchedulerNotifications({
      cycleType: 'poll',
      status: 'success',
      startedAt: '2026-03-27T10:00:00.000Z',
      finishedAt: '2026-03-27T10:00:30.000Z',
      durationMs: 30_000,
      steps: [
        { name: 'mealie_to_grocy', status: 'success' },
      ],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hc-ping.test/abc123',
      expect.objectContaining({
        dispatcher: expect.anything(),
      }),
    );
  });

  it('skips the generic webhook for successful runs when mode is errors_only', async () => {
    mockState.config.notificationWebhookUrl = 'https://hooks.test/notify';
    mockState.config.notificationWebhookMode = 'errors_only';
    fetchMock.mockResolvedValue({ ok: true });

    await sendSchedulerNotifications({
      cycleType: 'poll',
      status: 'success',
      startedAt: '2026-03-27T10:00:00.000Z',
      finishedAt: '2026-03-27T10:00:30.000Z',
      durationMs: 30_000,
      steps: [
        { name: 'mealie_to_grocy', status: 'success' },
      ],
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

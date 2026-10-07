import { describe, expect, it, vi } from 'vitest';
vi.mock('../../logger', () => ({ log: { error: vi.fn() } }));
vi.mock('../../sync/mutex', () => ({ acquireSyncLock: vi.fn(), releaseSyncLock: vi.fn() }));
import { shopRoute } from '../api-helpers';

describe('plugin errors across the custom-server and Next bundle boundary', () => {
  it('returns the safe plugin message from a different error class copy', async () => {
    class OtherBundlePluginCallError extends Error {
      name = 'PluginCallError';
      code = 'UPSTREAM_UNAVAILABLE';
      outcome = 'unknown';
      retryable = false;
    }
    const response = await shopRoute('Sign-in', () => { throw new OtherBundlePluginCallError('AH authorization-code exchange failed: HTTP 400. Start a new login.'); });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'AH authorization-code exchange failed: HTTP 400. Start a new login.', code: 'UPSTREAM_UNAVAILABLE', outcome: 'unknown', retryable: false });
  });

  it.each([
    new Error('secret upstream body'),
    Object.assign(new Error('secret upstream body'), { name: 'PluginCallError', code: 'INVALID_CODE', outcome: 'unknown', retryable: false }),
    Object.assign(new Error('secret upstream body'), { name: 'PluginCallError', code: 'INTERNAL' }),
  ])('keeps unexpected exceptions private', async error => {
    const response = await shopRoute('Sign-in', () => { throw error; });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal error' });
  });
});

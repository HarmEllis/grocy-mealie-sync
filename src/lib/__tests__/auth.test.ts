import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createSessionCookieValue,
  getAuthConfig,
  verifySessionCookieValue,
} from '../auth';

const ORIGINAL_ENV = { ...process.env };

describe('auth helpers', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.AUTH_ENABLED;
    delete process.env.AUTH_SECRET;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('enables auth by default when AUTH_SECRET is set', () => {
    process.env.AUTH_SECRET = 'top-secret';

    expect(getAuthConfig()).toEqual({
      enabled: true,
      configured: true,
      secret: 'top-secret',
    });
  });

  it('allows explicitly disabling auth even when AUTH_SECRET is set', () => {
    process.env.AUTH_ENABLED = 'false';
    process.env.AUTH_SECRET = 'top-secret';

    expect(getAuthConfig()).toEqual({
      enabled: false,
      configured: true,
      secret: 'top-secret',
    });
  });

  it('marks auth as misconfigured when enabled without AUTH_SECRET', () => {
    process.env.AUTH_ENABLED = 'true';

    expect(getAuthConfig()).toEqual({
      enabled: true,
      configured: false,
      secret: null,
    });
  });

  it('creates a verifiable session cookie value', async () => {
    const cookieValue = await createSessionCookieValue('top-secret');

    await expect(verifySessionCookieValue(cookieValue, 'top-secret')).resolves.toBe(true);
  });

  it('rejects expired session cookie values', async () => {
    const cookieValue = await createSessionCookieValue('top-secret', -1);

    await expect(verifySessionCookieValue(cookieValue, 'top-secret')).resolves.toBe(false);
  });

  it('rejects session cookie values signed with another secret', async () => {
    const cookieValue = await createSessionCookieValue('top-secret');

    await expect(verifySessionCookieValue(cookieValue, 'wrong-secret')).resolves.toBe(false);
  });
});

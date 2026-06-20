import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const ORIGINAL_ENV = { ...process.env };

function createRequest(url: string, init: { headers?: Record<string, string> } = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('x-forwarded-for')) {
    headers.set('x-forwarded-for', crypto.randomUUID());
  }
  return new NextRequest(url, { headers });
}

describe('proxy auth', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.AUTH_ENABLED;
    delete process.env.AUTH_SECRET;
    vi.resetModules();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('allows API requests when auth is disabled', async () => {
    const { proxy } = await import('../proxy');

    const response = await proxy(createRequest('http://localhost/api/status'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('returns 401 for protected API requests without valid auth', async () => {
    process.env.AUTH_ENABLED = 'true';
    process.env.AUTH_SECRET = 'top-secret';

    const { proxy } = await import('../proxy');
    const response = await proxy(createRequest('http://localhost/api/status'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('redirects the dashboard to /login when auth is enabled and no session exists', async () => {
    process.env.AUTH_ENABLED = 'true';
    process.env.AUTH_SECRET = 'top-secret';

    const { proxy } = await import('../proxy');
    const response = await proxy(createRequest('http://localhost/'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/login');
  });

  it('allows requests with a valid session cookie', async () => {
    process.env.AUTH_ENABLED = 'true';
    process.env.AUTH_SECRET = 'top-secret';

    const { createSessionCookieValue } = await import('../lib/auth');
    const sessionCookie = await createSessionCookieValue('top-secret');
    const { proxy } = await import('../proxy');

    const response = await proxy(createRequest('http://localhost/', {
      headers: {
        cookie: `__session=${sessionCookie}`,
      },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('returns 503 for protected API requests when auth is enabled but misconfigured', async () => {
    process.env.AUTH_ENABLED = 'true';

    const { proxy } = await import('../proxy');
    const response = await proxy(createRequest('http://localhost/api/status'));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: 'Authentication is enabled but AUTH_SECRET is not configured' });
  });
});

describe('proxy device token auth', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.AUTH_ENABLED = 'true';
    process.env.AUTH_SECRET = 'top-secret';
    process.env.DEVICE_API_TOKENS = 'scanner-token-1, scanner-token-2';
    vi.resetModules();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('accepts a device token on /api/device/* routes', async () => {
    const { proxy } = await import('../proxy');

    const response = await proxy(createRequest('http://localhost/api/device/v1/ping', {
      headers: { authorization: 'Bearer scanner-token-1' },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('accepts every configured device token after trimming', async () => {
    const { proxy } = await import('../proxy');

    const response = await proxy(createRequest('http://localhost/api/device/v1/ping', {
      headers: { authorization: 'Bearer scanner-token-2' },
    }));

    expect(response.status).toBe(200);
  });

  it('rejects a device token outside /api/device/*', async () => {
    const { proxy } = await import('../proxy');

    const response = await proxy(createRequest('http://localhost/api/status', {
      headers: { authorization: 'Bearer scanner-token-1' },
    }));

    expect(response.status).toBe(401);
  });

  it('rejects unknown tokens on /api/device/* routes', async () => {
    const { proxy } = await import('../proxy');

    const response = await proxy(createRequest('http://localhost/api/device/v1/ping', {
      headers: { authorization: 'Bearer wrong-token' },
    }));

    expect(response.status).toBe(401);
  });

  it('still accepts the admin AUTH_SECRET on /api/device/* routes', async () => {
    const { proxy } = await import('../proxy');

    const response = await proxy(createRequest('http://localhost/api/device/v1/ping', {
      headers: { authorization: 'Bearer top-secret' },
    }));

    expect(response.status).toBe(200);
  });

  it('only accepts AUTH_SECRET on device routes when DEVICE_API_TOKENS is unset', async () => {
    delete process.env.DEVICE_API_TOKENS;
    const { proxy } = await import('../proxy');

    const unauthorized = await proxy(createRequest('http://localhost/api/device/v1/ping', {
      headers: { authorization: 'Bearer scanner-token-1' },
    }));
    const authorized = await proxy(createRequest('http://localhost/api/device/v1/ping', {
      headers: { authorization: 'Bearer top-secret' },
    }));

    expect(unauthorized.status).toBe(401);
    expect(authorized.status).toBe(200);
  });
});

describe('proxy device token auth without global auth', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.AUTH_ENABLED;
    delete process.env.AUTH_SECRET;
    process.env.DEVICE_API_TOKENS = 'scanner-token-1';
    vi.resetModules();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('enforces device tokens even when AUTH_SECRET/AUTH_ENABLED are unset', async () => {
    const { proxy } = await import('../proxy');

    const unauthorized = await proxy(createRequest('http://localhost/api/device/v1/ping'));
    const authorized = await proxy(createRequest('http://localhost/api/device/v1/ping', {
      headers: { authorization: 'Bearer scanner-token-1' },
    }));

    expect(unauthorized.status).toBe(401);
    expect(authorized.status).toBe(200);
  });

  it('leaves non-device API routes open when only device tokens are configured', async () => {
    const { proxy } = await import('../proxy');

    const response = await proxy(createRequest('http://localhost/api/status'));

    expect(response.status).toBe(200);
  });

  it('skips device-token enforcement when auth is explicitly disabled', async () => {
    process.env.AUTH_ENABLED = 'false';
    const { proxy } = await import('../proxy');

    const response = await proxy(createRequest('http://localhost/api/device/v1/ping'));

    expect(response.status).toBe(200);
  });
});

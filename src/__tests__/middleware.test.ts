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

describe('middleware auth', () => {
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
    const { middleware } = await import('../middleware');

    const response = await middleware(createRequest('http://localhost/api/status'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('returns 401 for protected API requests without valid auth', async () => {
    process.env.AUTH_ENABLED = 'true';
    process.env.AUTH_SECRET = 'top-secret';

    const { middleware } = await import('../middleware');
    const response = await middleware(createRequest('http://localhost/api/status'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('redirects the dashboard to /login when auth is enabled and no session exists', async () => {
    process.env.AUTH_ENABLED = 'true';
    process.env.AUTH_SECRET = 'top-secret';

    const { middleware } = await import('../middleware');
    const response = await middleware(createRequest('http://localhost/'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/login');
  });

  it('allows requests with a valid session cookie', async () => {
    process.env.AUTH_ENABLED = 'true';
    process.env.AUTH_SECRET = 'top-secret';

    const { createSessionCookieValue } = await import('../lib/auth');
    const sessionCookie = await createSessionCookieValue('top-secret');
    const { middleware } = await import('../middleware');

    const response = await middleware(createRequest('http://localhost/', {
      headers: {
        cookie: `__session=${sessionCookie}`,
      },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('returns 503 for protected API requests when auth is enabled but misconfigured', async () => {
    process.env.AUTH_ENABLED = 'true';

    const { middleware } = await import('../middleware');
    const response = await middleware(createRequest('http://localhost/api/status'));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: 'Authentication is enabled but AUTH_SECRET is not configured' });
  });
});

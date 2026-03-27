import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { POST } from './route';

const ORIGINAL_ENV = { ...process.env };

describe('auth login route', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.AUTH_ENABLED;
    delete process.env.AUTH_SECRET;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('creates a session cookie when the secret is correct', async () => {
    process.env.AUTH_ENABLED = 'true';
    process.env.AUTH_SECRET = 'top-secret';

    const response = await POST(new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: 'top-secret' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: 'ok' });
    expect(response.headers.get('set-cookie')).toContain('__session=');
  });

  it('rejects an invalid secret', async () => {
    process.env.AUTH_ENABLED = 'true';
    process.env.AUTH_SECRET = 'top-secret';

    const response = await POST(new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: 'wrong-secret' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Invalid authentication secret' });
  });

  it('returns a disabled error when auth is turned off', async () => {
    process.env.AUTH_ENABLED = 'false';
    process.env.AUTH_SECRET = 'top-secret';

    const response = await POST(new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: 'top-secret' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Authentication is disabled' });
  });
});

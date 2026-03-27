import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AUTH_SESSION_COOKIE_NAME,
  createSessionCookieValue,
  getAuthConfig,
  getSessionCookieOptions,
  isValidAuthSecret,
} from '@/lib/auth';

const loginSchema = z.object({
  secret: z.string().min(1),
});

export async function POST(request: Request) {
  const authConfig = getAuthConfig();

  if (!authConfig.enabled) {
    return NextResponse.json(
      { error: 'Authentication is disabled' },
      { status: 400 },
    );
  }

  if (!authConfig.configured || !authConfig.secret) {
    return NextResponse.json(
      { error: 'Authentication is enabled but AUTH_SECRET is not configured' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.issues },
      { status: 400 },
    );
  }

  if (!isValidAuthSecret(parsed.data.secret, authConfig.secret)) {
    return NextResponse.json(
      { error: 'Invalid authentication secret' },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ status: 'ok' });
  response.cookies.set(
    AUTH_SESSION_COOKIE_NAME,
    await createSessionCookieValue(authConfig.secret),
    getSessionCookieOptions(),
  );
  return response;
}

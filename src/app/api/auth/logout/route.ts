import { NextResponse } from 'next/server';
import {
  AUTH_SESSION_COOKIE_NAME,
  getExpiredSessionCookieOptions,
} from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ status: 'ok' });
  response.cookies.set(
    AUTH_SESSION_COOKIE_NAME,
    '',
    getExpiredSessionCookieOptions(),
  );
  return response;
}

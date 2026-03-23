import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// In-memory rate limiter
//
// NOTE: Rate limiting relies on the client IP from X-Forwarded-For / X-Real-IP.
// When deployed behind a trusted reverse proxy (nginx, Traefik, Caddy), the
// proxy should overwrite these headers so clients cannot spoof them. When
// directly exposed, rate limiting is best-effort only. This is acceptable for
// a single-instance homelab deployment.
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const SYNC_ROUTE_LIMIT = 30; // /api/sync/* routes
const DEFAULT_API_LIMIT = 60; // other /api/* routes

// Periodic cleanup to prevent unbounded memory growth
const CLEANUP_INTERVAL_MS = 5 * 60_000; // 5 minutes
let lastCleanup = Date.now();

function cleanupStaleEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}

function checkRateLimit(ip: string, pathname: string): { allowed: boolean; limit: number; remaining: number } {
  cleanupStaleEntries();

  const isSyncRoute = pathname.startsWith('/api/sync/');
  const limit = isSyncRoute ? SYNC_ROUTE_LIMIT : DEFAULT_API_LIMIT;
  const key = `${ip}:${isSyncRoute ? 'sync' : 'api'}`;
  const now = Date.now();

  let entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(key, entry);
  }

  entry.count++;
  const remaining = Math.max(0, limit - entry.count);

  return { allowed: entry.count <= limit, limit, remaining };
}

// ---------------------------------------------------------------------------
// Cookie-based session for the web UI
//
// When AUTH_SECRET is set, the middleware issues an HttpOnly session cookie on
// page loads. API requests are then authenticated via either:
//   1. Authorization: Bearer <AUTH_SECRET>  (programmatic / external callers)
//   2. __session cookie                     (browser UI — set automatically)
//
// The session token is random and regenerated on each process restart.
// ---------------------------------------------------------------------------

const SESSION_TOKEN = Array.from(
  globalThis.crypto.getRandomValues(new Uint8Array(32)),
).map(b => b.toString(16).padStart(2, '0')).join('');

// ---------------------------------------------------------------------------
// Auth check
// ---------------------------------------------------------------------------

function constantTimeEqual(a: string, b: string): boolean {
  // Pad to equal length to avoid leaking length via timing.
  const len = Math.max(a.length, b.length);
  let mismatch = a.length !== b.length ? 1 : 0;
  for (let i = 0; i < len; i++) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

function checkAuth(request: NextRequest): boolean {
  const authSecret = process.env.AUTH_SECRET;

  // If AUTH_SECRET is not set, allow all requests (homelab single-user default)
  if (!authSecret) return true;

  // Check Authorization: Bearer <token>  (programmatic / external callers)
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return constantTimeEqual(parts[1], authSecret);
    }
  }

  // Check session cookie (browser UI — set by middleware on page loads)
  const sessionCookie = request.cookies.get('__session')?.value;
  if (sessionCookie && sessionCookie === SESSION_TOKEN) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bypass: health endpoint and static assets need no auth or rate limiting
  if (
    pathname === '/api/health' ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Page requests: set session cookie (for UI auth) and pass through
  if (pathname === '/') {
    const response = NextResponse.next();
    const authSecret = process.env.AUTH_SECRET;
    if (authSecret) {
      response.cookies.set('__session', SESSION_TOKEN, {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
      });
    }
    return response;
  }

  // API routes: auth + rate limiting
  if (pathname.startsWith('/api/')) {
    // Auth check
    if (!checkAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';

    const { allowed, limit, remaining } = checkRateLimit(ip, pathname);

    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
          },
        },
      );
    }

    // Attach rate limit headers to successful responses
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', String(limit));
    response.headers.set('X-RateLimit-Remaining', String(remaining));
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Match root page (to set session cookie for UI auth)
    '/',
  ],
};

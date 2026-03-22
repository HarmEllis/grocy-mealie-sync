import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// In-memory rate limiter
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
// Auth check
// ---------------------------------------------------------------------------

function isSameOriginRequest(request: NextRequest): boolean {
  // Sec-Fetch-Site is set by browsers on all fetch/XHR requests and cannot
  // be forged by cross-origin scripts (forbidden header).
  const secFetchSite = request.headers.get('sec-fetch-site');
  return secFetchSite === 'same-origin';
}

function checkAuth(request: NextRequest): boolean {
  const authSecret = process.env.AUTH_SECRET;

  // If AUTH_SECRET is not set, allow all requests (homelab single-user default)
  if (!authSecret) return true;

  // Same-origin browser requests (the web UI's own fetch calls) are exempt —
  // the UI is served by the same Next.js process and can't include a Bearer token.
  if (isSameOriginRequest(request)) return true;

  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  // Expect "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return false;

  // Constant-time comparison to prevent timing attacks
  const token = parts[1];
  if (token.length !== authSecret.length) return false;

  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ authSecret.charCodeAt(i);
  }
  return mismatch === 0;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bypass list: health endpoint, web UI, and static assets
  if (
    pathname === '/api/health' ||
    pathname === '/' ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Only apply auth + rate limiting to API routes
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
    // Match root page (to bypass auth)
    '/',
  ],
};

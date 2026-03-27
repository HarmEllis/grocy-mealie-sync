import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_SESSION_COOKIE_NAME,
  constantTimeEqual,
  getAuthConfig,
  verifySessionCookieValue,
} from './lib/auth';

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
// Authentication can be toggled via AUTH_ENABLED. When enabled, API requests
// are authenticated via either:
//   1. Authorization: Bearer <AUTH_SECRET>  (programmatic / external callers)
//   2. __session cookie                     (browser UI, created by /api/auth/login)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Auth check
// ---------------------------------------------------------------------------

async function checkAuth(request: NextRequest, authSecret: string): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer' && constantTimeEqual(parts[1], authSecret)) {
      return true;
    }
  }

  const sessionCookie = request.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value;
  return verifySessionCookieValue(sessionCookie, authSecret);
}

function createUnauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 },
  );
}

function createAuthMisconfiguredResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Authentication is enabled but AUTH_SECRET is not configured' },
    { status: 503 },
  );
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authConfig = getAuthConfig();

  // Bypass: health endpoint and static assets need no auth or rate limiting
  if (
    pathname === '/api/health' ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  if (pathname === '/login') {
    if (!authConfig.enabled) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    if (!authConfig.configured || !authConfig.secret) {
      return NextResponse.next();
    }

    if (await checkAuth(request, authConfig.secret)) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
  }

  // API routes: auth + rate limiting
  if (pathname.startsWith('/api/')) {
    const isPublicAuthRoute = pathname === '/api/auth/login' || pathname === '/api/auth/logout';

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

    // Auth check
    if (authConfig.enabled && !isPublicAuthRoute) {
      if (!authConfig.configured || !authConfig.secret) {
        return createAuthMisconfiguredResponse();
      }
      if (!await checkAuth(request, authConfig.secret)) {
        return createUnauthorizedResponse();
      }
    }

    // Attach rate limit headers to successful responses
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', String(limit));
    response.headers.set('X-RateLimit-Remaining', String(remaining));
    return response;
  }

  if (pathname === '/') {
    if (!authConfig.enabled) {
      return NextResponse.next();
    }

    if (!authConfig.configured || !authConfig.secret) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (!await checkAuth(request, authConfig.secret)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Match protected UI routes
    '/',
    '/login',
  ],
};

import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import {
  DeviceConflictError,
  DeviceProductNotFoundError,
  DeviceUpstreamTimeoutError,
} from '@/lib/use-cases/devices/scanner';

/** Translates device use-case errors into the contract's HTTP responses. */
export function deviceErrorResponse(error: unknown): NextResponse {
  if (error instanceof DeviceProductNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof DeviceConflictError) {
    return NextResponse.json({ error: error.message, ...error.payload }, { status: 409 });
  }
  if (error instanceof DeviceUpstreamTimeoutError) {
    log.warn('[DeviceAPI] Upstream timeout:', {
      upstream: error.upstream,
      timeoutMs: error.timeoutMs,
    });
    return NextResponse.json({ error: error.message }, { status: 504 });
  }
  log.error('[DeviceAPI] Request failed:', error);
  const message = error instanceof Error ? error.message : 'Internal server error';
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function parseJsonBody(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

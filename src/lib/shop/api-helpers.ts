import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { log } from '../logger';
import { acquireSyncLock, releaseSyncLock } from '../sync/mutex';
import { PluginCallError } from '../plugins/gateway';

export class ShopApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Run a route body and map validation, domain and plugin errors to JSON responses. */
export async function shopRoute<T>(label: string, body: () => Promise<T> | T): Promise<NextResponse> {
  try {
    return NextResponse.json(await body());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: z.prettifyError(error) }, { status: 400 });
    }
    if (error instanceof ShopApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof PluginCallError) {
      const status = error.code === 'NOT_CONNECTED' ? 503 : error.code === 'NOT_SUPPORTED' ? 400 : 502;
      return NextResponse.json({ error: error.message, code: error.code, outcome: error.outcome }, { status });
    }
    log.error(`[Shop API] ${label} failed:`, error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/** Ledger writers must hold the sync lock so they never interleave with a poll. */
export async function withSyncLock<T>(body: () => Promise<T> | T): Promise<T> {
  if (!acquireSyncLock()) {
    throw new ShopApiError(409, 'A sync is running. Try again in a moment.');
  }
  try {
    return await body();
  } finally {
    releaseSyncLock();
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ShopApiError(400, 'Request body must be JSON');
  }
}

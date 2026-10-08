import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { log } from '../logger';
import { acquireLease, acquireSyncLock, releaseLease, releaseSyncLock } from '../sync/mutex';
import { errorCodeSchema, outcomeSchema } from '../plugins/protocol/v1';

// The custom WebSocket server and Next route bundle load separate class copies.
// Validate the public error contract instead of relying on instanceof.
export const pluginCallErrorSchema = z.object({
  name: z.literal('PluginCallError'),
  message: z.string().max(1000),
  code: z.union([errorCodeSchema, z.enum(['NOT_CONNECTED', 'BAD_RESPONSE'])]),
  outcome: outcomeSchema,
  retryable: z.boolean(),
});

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
    const pluginError = pluginCallErrorSchema.safeParse(error);
    if (pluginError.success) {
      const detail = pluginError.data;
      const status = detail.code === 'NOT_CONNECTED' ? 503 : detail.code === 'NOT_SUPPORTED' ? 400 : 502;
      return NextResponse.json({ error: detail.message, code: detail.code, outcome: detail.outcome, retryable: detail.retryable }, { status });
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

export const PLUGIN_AUTH_TIMEOUT_MS = 60_000;

/** Serialize interactive auth per installation without blocking unrelated synchronization. */
export async function withPluginAuthLock<T>(id: string, body: () => Promise<T>): Promise<T> {
  const name = `plugin-auth:${id}`;
  const owner = randomUUID();
  if (!acquireLease(name, owner, PLUGIN_AUTH_TIMEOUT_MS + 10_000)) {
    throw new ShopApiError(409, 'An account action is already running for this plugin. Try again in a moment.');
  }
  try { return await body(); }
  finally { releaseLease(name, owner); }
}

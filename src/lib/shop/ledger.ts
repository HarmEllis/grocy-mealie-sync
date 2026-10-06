import { randomUUID } from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { appMeta, shopEffects } from '../db/schema';

/**
 * Durable per-effect ledger for external writes (Grocy stock, Mealie rows).
 *
 * Guarantees: every write is committed as `in_flight` before the HTTP call.
 * Only definitive failures become `not_applied` and may be retried. Anything
 * else becomes `unknown` and is never retried automatically: it is verified
 * (Grocy note marker, Mealie re-read) and otherwise waits for an explicit user
 * decision. Exactly-once is impossible without idempotency keys upstream.
 */

export type EffectStatus = 'planned' | 'in_flight' | 'applied' | 'not_applied' | 'unknown' | 'superseded' | 'cancelled';
export type EffectKind = 'grocy_add' | 'grocy_consume' | 'grocy_undo' | 'mealie_reduce';
export type EffectSourceKind = 'check' | 'receipt' | 'discrepancy' | 'substitution';

export interface ShopEffect<P = Record<string, unknown>> {
  id: string;
  effectKey: string;
  kind: EffectKind;
  sourceKind: EffectSourceKind;
  sourceRef: string;
  payload: P;
  status: EffectStatus;
  attempts: number;
  evidence: Record<string, unknown> | null;
  externalRef: string | null;
  error: string | null;
  dependsOn: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
}

type EffectRow = typeof shopEffects.$inferSelect;
export type LedgerTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const RETRYABLE_STATUSES: EffectStatus[] = ['planned', 'not_applied'];

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function toShopEffect<P>(row: EffectRow): ShopEffect<P> {
  return {
    id: row.id,
    effectKey: row.effectKey,
    kind: row.kind as EffectKind,
    sourceKind: row.sourceKind as EffectSourceKind,
    sourceRef: row.sourceRef,
    payload: (parseJson<P>(row.payloadJson) ?? {}) as P,
    status: row.status as EffectStatus,
    attempts: row.attempts,
    evidence: parseJson<Record<string, unknown>>(row.evidenceJson),
    externalRef: row.externalRef,
    error: row.error,
    dependsOn: row.dependsOn,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    startedAt: row.startedAt,
  };
}

/** Marker written into Grocy notes so an uncertain write can be found later. */
export function effectMarker(effectId: string): string {
  return `[gms:${effectId}]`;
}

export function markerNeedle(effectId: string): string {
  return `gms:${effectId}`;
}

const LEDGER_ACTIVATED_AT_KEY = 'ledger_activated_at';

/** First moment manual checks were tracked in the ledger; receipts before it cannot be reconciled. */
export function ensureLedgerActivated(now = new Date()): Date {
  db.insert(appMeta).values({ key: LEDGER_ACTIVATED_AT_KEY, value: now.toISOString() }).onConflictDoNothing().run();
  return getLedgerActivatedAt() ?? now;
}

export function getLedgerActivatedAt(): Date | null {
  const row = db.select().from(appMeta).where(eq(appMeta.key, LEDGER_ACTIVATED_AT_KEY)).get();
  return row ? new Date(row.value) : null;
}

export interface EnsureEffectInput<P> {
  effectKey: string;
  kind: EffectKind;
  sourceKind: EffectSourceKind;
  sourceRef: string;
  payload: P;
  dependsOn?: string | null;
}

/** Create the effect for a stable key, or return the existing one unchanged. */
export function ensureEffect<P>(input: EnsureEffectInput<P>, now = new Date(), tx: LedgerTx | typeof db = db): ShopEffect<P> {
  tx.insert(shopEffects).values({
    id: randomUUID(),
    effectKey: input.effectKey,
    kind: input.kind,
    sourceKind: input.sourceKind,
    sourceRef: input.sourceRef,
    payloadJson: JSON.stringify(input.payload),
    status: 'planned',
    dependsOn: input.dependsOn ?? null,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing().run();
  const row = tx.select().from(shopEffects).where(eq(shopEffects.effectKey, input.effectKey)).get();
  if (!row) throw new Error(`Effect ${input.effectKey} could not be created`);
  return toShopEffect<P>(row);
}

export function getEffect<P = Record<string, unknown>>(id: string): ShopEffect<P> | null {
  const row = db.select().from(shopEffects).where(eq(shopEffects.id, id)).get();
  return row ? toShopEffect<P>(row) : null;
}

export function getEffectByKey<P = Record<string, unknown>>(effectKey: string): ShopEffect<P> | null {
  const row = db.select().from(shopEffects).where(eq(shopEffects.effectKey, effectKey)).get();
  return row ? toShopEffect<P>(row) : null;
}

export function listEffects<P = Record<string, unknown>>(filter: { statuses?: EffectStatus[]; sourceKind?: EffectSourceKind; sourceRefs?: string[]; kinds?: EffectKind[] } = {}): ShopEffect<P>[] {
  const conditions = [];
  if (filter.statuses?.length) conditions.push(inArray(shopEffects.status, filter.statuses));
  if (filter.sourceKind) conditions.push(eq(shopEffects.sourceKind, filter.sourceKind));
  if (filter.kinds?.length) conditions.push(inArray(shopEffects.kind, filter.kinds));
  if (filter.sourceRefs) {
    if (filter.sourceRefs.length === 0) return [];
    conditions.push(inArray(shopEffects.sourceRef, filter.sourceRefs));
  }
  const rows = conditions.length > 0
    ? db.select().from(shopEffects).where(and(...conditions)).all()
    : db.select().from(shopEffects).all();
  return rows.map(row => toShopEffect<P>(row));
}

/**
 * Atomically claim an effect for one attempt. Returns false when another
 * attempt already claimed it or its status no longer allows a write.
 */
export function beginAttempt(effectId: string, now = new Date()): boolean {
  const existing = db.select().from(shopEffects).where(eq(shopEffects.id, effectId)).get();
  if (!existing) return false;
  const result = db.update(shopEffects)
    .set({ status: 'in_flight', attempts: existing.attempts + 1, startedAt: now, updatedAt: now, error: null })
    .where(and(eq(shopEffects.id, effectId), inArray(shopEffects.status, RETRYABLE_STATUSES)))
    .run();
  return result.changes === 1;
}

export interface CompleteEffectInput {
  status: Exclude<EffectStatus, 'planned' | 'in_flight'>;
  evidence?: Record<string, unknown> | null;
  externalRef?: string | null;
  error?: string | null;
  /** Only transition when the effect currently has one of these statuses. */
  fromStatuses?: EffectStatus[];
}

/**
 * Record an effect outcome. `withinTransaction` runs in the same SQLite
 * transaction, so derived state (for example low-stock suppression) can never
 * diverge from the ledger.
 */
export function completeEffect(
  effectId: string,
  input: CompleteEffectInput,
  withinTransaction?: (tx: LedgerTx) => void,
  now = new Date(),
): boolean {
  return db.transaction((tx) => {
    const existing = tx.select().from(shopEffects).where(eq(shopEffects.id, effectId)).get();
    if (!existing) return false;
    const allowed = input.fromStatuses ?? ['in_flight', 'unknown', 'planned', 'not_applied'];
    if (!allowed.includes(existing.status as EffectStatus)) return false;
    const evidence = { ...(parseJson<Record<string, unknown>>(existing.evidenceJson) ?? {}), ...(input.evidence ?? {}) };
    tx.update(shopEffects).set({
      status: input.status,
      evidenceJson: Object.keys(evidence).length > 0 ? JSON.stringify(evidence) : null,
      externalRef: input.externalRef ?? existing.externalRef,
      error: input.error ?? (input.status === 'applied' ? null : existing.error),
      updatedAt: now,
    }).where(eq(shopEffects.id, effectId)).run();
    withinTransaction?.(tx);
    return true;
  });
}

export function appendEvidence(effectId: string, evidence: Record<string, unknown>, now = new Date()): void {
  const existing = db.select().from(shopEffects).where(eq(shopEffects.id, effectId)).get();
  if (!existing) return;
  const merged = { ...(parseJson<Record<string, unknown>>(existing.evidenceJson) ?? {}), ...evidence };
  db.update(shopEffects).set({ evidenceJson: JSON.stringify(merged), updatedAt: now }).where(eq(shopEffects.id, effectId)).run();
}

/**
 * Effects left `in_flight` by a crashed or interrupted process. Call only
 * while holding the sync lock: every ledger writer runs under it, so no
 * legitimate attempt can be running at that point.
 */
export function recoverInterruptedEffects(now = new Date()): number {
  const rows = db.select().from(shopEffects).where(eq(shopEffects.status, 'in_flight')).all();
  for (const row of rows) {
    completeEffect(row.id, {
      status: 'unknown',
      evidence: { interruptedAt: now.toISOString() },
      error: 'The process stopped while this write was in flight.',
      fromStatuses: ['in_flight'],
    }, undefined, now);
  }
  return rows.length;
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

const CONNECT_PHASE_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH', 'ERR_INVALID_URL', 'UND_ERR_CONNECT_TIMEOUT']);

function errorCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

/**
 * `not_applied` only when the write definitely did not happen: the
 * connection was never established, or the server rejected the request as a
 * client error. Timeouts, dropped connections and server errors are `unknown`.
 */
export function classifyWriteError(error: unknown): 'not_applied' | 'unknown' {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === 'number') {
    return status >= 400 && status < 500 && status !== 408 ? 'not_applied' : 'unknown';
  }
  const code = errorCode(error);
  if (code && CONNECT_PHASE_CODES.has(code)) return 'not_applied';
  return 'unknown';
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return String(error).slice(0, 500);
}

/** Thrown when a write outcome is uncertain; callers must not retry it. */
export class UncertainWriteError extends Error {
  constructor(readonly effectId: string, message: string, readonly productId: number | null = null) {
    super(message);
    this.name = 'UncertainWriteError';
  }
}

/**
 * Thrown when a manual check must not book automatically because a receipt or
 * substitution already covers the same Mealie row and its list update is not
 * settled. The user decides through a `check_after_receipt` discrepancy.
 */
export class CheckDeferredError extends Error {
  constructor(readonly lifecycleId: string, readonly effectIds: string[]) {
    super('A receipt already covers this shopping row and its list update is not settled; the check waits for review.');
    this.name = 'CheckDeferredError';
  }
}

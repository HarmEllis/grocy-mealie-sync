import { randomUUID } from 'crypto';
import { and, asc, count, desc, eq, gte, inArray, like, lte, lt, or, type SQL } from 'drizzle-orm';
import { config } from './config';
import { db } from './db';
import { historyEvents, historyRuns } from './db/schema';
import { containsText } from './db/text-search';
import {
  historyRunActions,
  historyRunStatuses,
  historyRunTriggers,
  isHistoryRunAction,
  isHistoryRunStatus,
  isHistoryRunTrigger,
  type HistoryEventCategory,
  type HistoryEventEntityKind,
  type HistoryEventLevel,
  type HistoryEventKind,
  type HistorySystem,
  type HistoryRunAction,
  type HistoryRunStatus,
  type HistoryRunTrigger,
} from './history-types';

export {
  historyRunActions,
  historyRunStatuses,
  historyRunTriggers,
  isHistoryRunAction,
  isHistoryRunStatus,
  isHistoryRunTrigger,
};
export type {
  HistoryEventCategory,
  HistoryEventEntityKind,
  HistoryEventLevel,
  HistoryRunAction,
  HistoryRunStatus,
  HistoryRunTrigger,
};

export interface HistoryEventInput {
  kind?: HistoryEventKind;
  productName?: string | null;
  source?: HistorySystem | null;
  target?: HistorySystem | null;
  reason?: string | null;
  createdAt?: Date;
  level: HistoryEventLevel;
  category: HistoryEventCategory;
  entityKind?: HistoryEventEntityKind;
  entityRef?: string | null;
  message: string;
  details?: unknown;
}

export interface RecordHistoryRunInput {
  trigger: HistoryRunTrigger;
  action: HistoryRunAction;
  status: HistoryRunStatus;
  startedAt: Date;
  finishedAt: Date;
  message?: string | null;
  summary?: unknown;
  events?: HistoryEventInput[];
  now?: Date;
}

export interface HistoryRunRecord {
  id: string;
  trigger: HistoryRunTrigger;
  action: HistoryRunAction;
  status: HistoryRunStatus;
  message: string | null;
  startedAt: Date;
  finishedAt: Date;
  summary: unknown;
  eventCount: number;
}

export interface HistoryEventRecord {
  kind: HistoryEventKind;
  productName: string | null;
  source: HistorySystem | null;
  target: HistorySystem | null;
  reason: string | null;
  id: string;
  runId: string;
  level: HistoryEventLevel;
  category: HistoryEventCategory;
  entityKind: HistoryEventEntityKind;
  entityRef: string | null;
  message: string;
  details: unknown;
  createdAt: Date;
}

export interface HistoryRunDetails {
  run: HistoryRunRecord;
  events: HistoryEventRecord[];
}

export interface HistoryRunListFilters {
  search?: string;
  action?: HistoryRunAction | null;
  trigger?: HistoryRunTrigger | null;
  status?: HistoryRunStatus | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
}

const stepMarkerSuffixes = [
  ' step success.',
  ' step partial.',
  ' step skipped.',
  ' step failed.',
  ' step failure.',
] as const;

function parseJsonValue(value: string | null): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function serializeJsonValue(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }

  return JSON.stringify(value);
}

function mapRunRow(row: {
  id: string;
  trigger: string;
  action: string;
  status: string;
  message: string | null;
  summaryJson: string | null;
  startedAt: Date;
  finishedAt: Date;
  event_count?: number;
  eventCount?: number;
}): HistoryRunRecord {
  return {
    id: row.id,
    trigger: row.trigger as HistoryRunTrigger,
    action: row.action as HistoryRunAction,
    status: row.status as HistoryRunStatus,
    message: row.message,
    summary: parseJsonValue(row.summaryJson),
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    eventCount: Number(row.eventCount ?? row.event_count ?? 0),
  };
}

function mapEventRow(row: {
  kind: string;
  productName: string | null;
  source: string | null;
  target: string | null;
  reason: string | null;
  id: string;
  runId: string;
  level: string;
  category: string;
  entityKind: string | null;
  entityRef: string | null;
  message: string;
  detailsJson: string | null;
  createdAt: Date;
}): HistoryEventRecord {
  return {
    kind: row.kind as HistoryEventKind,
    productName: row.productName,
    source: row.source as HistorySystem | null,
    target: row.target as HistorySystem | null,
    reason: row.reason,
    id: row.id,
    runId: row.runId,
    level: row.level as HistoryEventLevel,
    category: row.category as HistoryEventCategory,
    entityKind: row.entityKind as HistoryEventEntityKind,
    entityRef: row.entityRef,
    message: row.message,
    details: parseJsonValue(row.detailsJson),
    createdAt: row.createdAt,
  };
}

function getRetentionCutoff(now: Date): number | null {
  if (!config.historyEnabled || config.historyRetentionDays === null) {
    return null;
  }

  return now.getTime() - (config.historyRetentionDays * 24 * 60 * 60 * 1000);
}

function buildRunSearchClause(searchPattern: string): SQL<unknown> {
  return or(
    like(historyRuns.id, searchPattern),
    like(historyRuns.action, searchPattern),
    like(historyRuns.trigger, searchPattern),
    like(historyRuns.message, searchPattern),
  )!;
}

async function findMatchingHistoryRunIds(searchPattern: string): Promise<string[]> {
  const directMatches = db.select({ id: historyRuns.id })
    .from(historyRuns)
    .where(buildRunSearchClause(searchPattern))
    .all();
  const eventMatches = db.select({ runId: historyEvents.runId })
    .from(historyEvents)
    .where(like(historyEvents.message, searchPattern))
    .groupBy(historyEvents.runId)
    .all();

  return Array.from(new Set([
    ...directMatches.map(({ id }) => id),
    ...eventMatches.map(({ runId }) => runId),
  ]));
}

async function getEventCounts(runIds: string[]): Promise<Map<string, number>> {
  if (runIds.length === 0) {
    return new Map();
  }

  const rows = db.select({
    runId: historyEvents.runId,
    eventCount: count(historyEvents.id),
  })
    .from(historyEvents)
    .where(inArray(historyEvents.runId, runIds))
    .groupBy(historyEvents.runId)
    .all();

  return new Map(rows.map(row => [row.runId, Number(row.eventCount)]));
}

function isStepMarkerEvent(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return stepMarkerSuffixes.some(suffix => normalizedMessage.endsWith(suffix));
}

function compareHistoryEvents(left: HistoryEventRecord, right: HistoryEventRecord): number {
  const createdAtDelta = left.createdAt.getTime() - right.createdAt.getTime();
  if (createdAtDelta !== 0) {
    return createdAtDelta;
  }

  const stepMarkerDelta = Number(isStepMarkerEvent(left.message)) - Number(isStepMarkerEvent(right.message));
  if (stepMarkerDelta !== 0) {
    return stepMarkerDelta;
  }

  return left.id.localeCompare(right.id);
}

export function getHistoryFeatureState(): { enabled: boolean; retentionDays: number | null } {
  return {
    enabled: config.historyEnabled,
    retentionDays: config.historyRetentionDays,
  };
}

export async function initializeHistoryStorage(): Promise<void> {
  if (!config.historyEnabled) {
    await clearHistory();
    return;
  }

  await purgeExpiredHistory();
}

export async function clearHistory(): Promise<void> {
  db.transaction((tx) => {
    tx.delete(historyEvents).run();
    tx.delete(historyRuns).run();
  });
}

export async function purgeExpiredHistory(now: Date = new Date()): Promise<number> {
  const cutoff = getRetentionCutoff(now);
  if (cutoff === null) {
    return 0;
  }

  const staleRunIds = db.select({ id: historyRuns.id })
    .from(historyRuns)
    .where(lt(historyRuns.finishedAt, new Date(cutoff)))
    .all();

  if (staleRunIds.length === 0) {
    return 0;
  }

  const runIds = staleRunIds.map(({ id }) => id);
  db.transaction((tx) => {
    tx.delete(historyEvents).where(inArray(historyEvents.runId, runIds)).run();
    tx.delete(historyRuns).where(inArray(historyRuns.id, runIds)).run();
  });
  return staleRunIds.length;
}

export async function recordHistoryRun(input: RecordHistoryRunInput): Promise<string | null> {
  if (!config.historyEnabled) {
    return null;
  }

  const runId = randomUUID();
  const summaryJson = serializeJsonValue(input.summary);
  const now = input.now ?? input.finishedAt;
  const events = input.events ?? [];

  db.transaction((tx) => {
    tx.insert(historyRuns).values({
      id: runId,
      trigger: input.trigger,
      action: input.action,
      status: input.status,
      message: input.message ?? null,
      summaryJson,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
    }).run();

    if (events.length > 0) {
      tx.insert(historyEvents).values(events.map((event) => ({
        id: randomUUID(),
        runId,
        level: event.level,
        kind: event.kind ?? inferEventKind(input, event),
        productName: event.productName ?? inferProductName(event),
        source: event.source ?? (input.trigger === 'scanner' ? 'Scanner' : input.trigger === 'manual' ? 'App' : null),
        target: event.target ?? (event.category === 'inventory' ? 'Grocy' : event.category === 'shopping' ? 'Mealie' : null),
        reason: event.reason ?? (input.trigger === 'manual' ? 'Manual action.' : null),
        category: event.category,
        entityKind: event.entityKind ?? null,
        entityRef: event.entityRef ?? null,
        message: event.message,
        detailsJson: serializeJsonValue(event.details),
        createdAt: event.createdAt ?? input.finishedAt,
      }))).run();
    }
  });
  await purgeExpiredHistory(now);

  return runId;
}

export async function listHistoryRuns(limit = 100, filters: HistoryRunListFilters = {}): Promise<HistoryRunRecord[]> {
  if (!config.historyEnabled) {
    return [];
  }

  const whereClauses: SQL<unknown>[] = [];
  const search = filters.search?.trim() ?? '';

  if (search) {
    const matchingRunIds = await findMatchingHistoryRunIds(`%${search}%`);
    if (matchingRunIds.length === 0) {
      return [];
    }

    whereClauses.push(inArray(historyRuns.id, matchingRunIds));
  }

  if (filters.action) {
    whereClauses.push(eq(historyRuns.action, filters.action));
  }

  if (filters.trigger) {
    whereClauses.push(eq(historyRuns.trigger, filters.trigger));
  }

  if (filters.status) {
    whereClauses.push(eq(historyRuns.status, filters.status));
  }

  if (filters.dateFrom) {
    whereClauses.push(gte(historyRuns.startedAt, filters.dateFrom));
  }

  if (filters.dateTo) {
    whereClauses.push(lte(historyRuns.startedAt, filters.dateTo));
  }

  const rows = db.select({
    id: historyRuns.id,
    trigger: historyRuns.trigger,
    action: historyRuns.action,
    status: historyRuns.status,
    message: historyRuns.message,
    summaryJson: historyRuns.summaryJson,
    startedAt: historyRuns.startedAt,
    finishedAt: historyRuns.finishedAt,
  })
    .from(historyRuns)
    .where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
    .orderBy(desc(historyRuns.finishedAt), desc(historyRuns.startedAt), desc(historyRuns.id))
    .limit(limit)
    .all();

  const eventCounts = await getEventCounts(rows.map(row => row.id));
  return rows.map(row => mapRunRow({
    ...row,
    eventCount: eventCounts.get(row.id) ?? 0,
  }));
}

export async function getHistoryRunDetails(runId: string): Promise<HistoryRunDetails | null> {
  if (!config.historyEnabled) {
    return null;
  }

  const runRow = db.select({
    id: historyRuns.id,
    trigger: historyRuns.trigger,
    action: historyRuns.action,
    status: historyRuns.status,
    message: historyRuns.message,
    summaryJson: historyRuns.summaryJson,
    startedAt: historyRuns.startedAt,
    finishedAt: historyRuns.finishedAt,
  })
    .from(historyRuns)
    .where(eq(historyRuns.id, runId))
    .get();

  if (!runRow) {
    return null;
  }

  const eventRows = db.select({
    kind: historyEvents.kind,
    productName: historyEvents.productName,
    source: historyEvents.source,
    target: historyEvents.target,
    reason: historyEvents.reason,
    id: historyEvents.id,
    runId: historyEvents.runId,
    level: historyEvents.level,
    category: historyEvents.category,
    entityKind: historyEvents.entityKind,
    entityRef: historyEvents.entityRef,
    message: historyEvents.message,
    detailsJson: historyEvents.detailsJson,
    createdAt: historyEvents.createdAt,
  })
    .from(historyEvents)
    .where(eq(historyEvents.runId, runId))
    .orderBy(asc(historyEvents.createdAt), asc(historyEvents.id))
    .all();
  const events = eventRows
    .map(mapEventRow)
    .sort(compareHistoryEvents);

  return {
    run: mapRunRow({
      ...runRow,
      eventCount: events.length,
    }),
    events,
  };
}

function inferEventKind(run: RecordHistoryRunInput, event: HistoryEventInput): HistoryEventKind {
  if (run.status === 'skipped') return 'diagnostic';
  if (event.level !== 'info') return 'issue';
  if (run.trigger !== 'scheduler' && run.action !== 'product_sync' && event.category !== 'sync') return 'mutation';
  return 'diagnostic';
}

function inferProductName(event: HistoryEventInput): string | null {
  if (!['product', 'shopping_item', 'stock_entry'].includes(event.entityKind ?? '') || !event.details || typeof event.details !== 'object') return null;
  const details = event.details as Record<string, unknown>;
  for (const key of ['grocyProductName', 'mealieFoodName', 'productName', 'foodName', 'name']) {
    if (typeof details[key] === 'string' && details[key]) return details[key];
  }
  return null;
}

export interface HistoryActivityRecord extends HistoryEventRecord {
  trigger: HistoryRunTrigger;
  action: HistoryRunAction;
  status: HistoryRunStatus;
}

export interface HistoryActivityFilters extends HistoryRunListFilters {
  kind?: 'mutation' | 'issue' | null;
  offset?: number;
}

/** Filter events before limiting: quiet cycles never crowd out product activity. */
export async function listHistoryActivity(limit = 50, filters: HistoryActivityFilters = {}): Promise<HistoryActivityRecord[]> {
  if (!config.historyEnabled) return [];
  const clauses: SQL<unknown>[] = [inArray(historyEvents.kind, filters.kind ? [filters.kind] : ['mutation', 'issue'])];
  const search = filters.search?.trim();
  if (search) {
    clauses.push(containsText([historyEvents.productName, historyEvents.message, historyEvents.entityRef, historyEvents.reason, historyEvents.detailsJson], search));
  }
  if (filters.action) clauses.push(eq(historyRuns.action, filters.action));
  if (filters.trigger) clauses.push(eq(historyRuns.trigger, filters.trigger));
  if (filters.status) clauses.push(eq(historyRuns.status, filters.status));
  if (filters.dateFrom) clauses.push(gte(historyEvents.createdAt, filters.dateFrom));
  if (filters.dateTo) clauses.push(lte(historyEvents.createdAt, filters.dateTo));
  const cutoff = getRetentionCutoff(new Date());
  if (cutoff !== null) clauses.push(gte(historyRuns.finishedAt, new Date(cutoff)));
  const rows = db.select({
    id: historyEvents.id, runId: historyEvents.runId, level: historyEvents.level,
    kind: historyEvents.kind, productName: historyEvents.productName,
    source: historyEvents.source, target: historyEvents.target, reason: historyEvents.reason,
    category: historyEvents.category, entityKind: historyEvents.entityKind,
    entityRef: historyEvents.entityRef, message: historyEvents.message,
    detailsJson: historyEvents.detailsJson, createdAt: historyEvents.createdAt,
    trigger: historyRuns.trigger, action: historyRuns.action, status: historyRuns.status,
  }).from(historyEvents).innerJoin(historyRuns, eq(historyRuns.id, historyEvents.runId))
    .where(and(...clauses))
    .orderBy(desc(historyEvents.createdAt), desc(historyEvents.id))
    .limit(Math.min(Math.max(limit, 1), 101))
    .offset(Math.max(filters.offset ?? 0, 0)).all();
  return rows.map(row => ({
    ...mapEventRow(row), trigger: row.trigger as HistoryRunTrigger,
    action: row.action as HistoryRunAction, status: row.status as HistoryRunStatus,
  }));
}

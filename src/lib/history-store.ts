import { randomUUID } from 'crypto';
import { and, asc, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { config } from './config';
import { db } from './db';
import { historyEvents, historyRuns } from './db/schema';
import {
  historyRunActions,
  historyRunTriggers,
  isHistoryRunAction,
  isHistoryRunTrigger,
  type HistoryEventCategory,
  type HistoryEventEntityKind,
  type HistoryEventLevel,
  type HistoryRunAction,
  type HistoryRunStatus,
  type HistoryRunTrigger,
} from './history-types';

export {
  historyRunActions,
  historyRunTriggers,
  isHistoryRunAction,
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
}

let historyStorageReady = false;

function ensureHistoryStorage(): void {
  if (historyStorageReady) {
    return;
  }

  db.run(sql`
    CREATE TABLE IF NOT EXISTS history_runs (
      id text PRIMARY KEY NOT NULL,
      trigger text NOT NULL,
      action text NOT NULL,
      status text NOT NULL,
      message text,
      summary_json text,
      started_at integer NOT NULL,
      finished_at integer NOT NULL
    )
  `);
  db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_history_runs_started_at
      ON history_runs (started_at DESC)
  `);
  db.run(sql`
    CREATE TABLE IF NOT EXISTS history_events (
      id text PRIMARY KEY NOT NULL,
      run_id text NOT NULL,
      level text NOT NULL,
      category text NOT NULL,
      entity_kind text,
      entity_ref text,
      message text NOT NULL,
      details_json text,
      created_at integer NOT NULL
    )
  `);
  db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_history_events_run_id
      ON history_events (run_id, created_at)
  `);

  historyStorageReady = true;
}

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

export function getHistoryFeatureState(): { enabled: boolean; retentionDays: number | null } {
  return {
    enabled: config.historyEnabled,
    retentionDays: config.historyRetentionDays,
  };
}

export async function initializeHistoryStorage(): Promise<void> {
  ensureHistoryStorage();

  if (!config.historyEnabled) {
    await clearHistory();
    return;
  }

  await purgeExpiredHistory();
}

export async function clearHistory(): Promise<void> {
  ensureHistoryStorage();

  db.transaction((tx) => {
    tx.delete(historyEvents).run();
    tx.delete(historyRuns).run();
  });
}

export async function purgeExpiredHistory(now: Date = new Date()): Promise<number> {
  ensureHistoryStorage();

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
  ensureHistoryStorage();

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
        category: event.category,
        entityKind: event.entityKind ?? null,
        entityRef: event.entityRef ?? null,
        message: event.message,
        detailsJson: serializeJsonValue(event.details),
        createdAt: input.finishedAt,
      }))).run();
    }
  });
  await purgeExpiredHistory(now);

  return runId;
}

export async function listHistoryRuns(limit = 100, filters: HistoryRunListFilters = {}): Promise<HistoryRunRecord[]> {
  ensureHistoryStorage();

  if (!config.historyEnabled) {
    return [];
  }

  const whereClauses: Array<ReturnType<typeof sql> | undefined> = [];
  const search = filters.search?.trim().toLowerCase() ?? '';

  if (search) {
    const searchPattern = `%${search}%`;
    whereClauses.push(sql`
      (
        lower(${historyRuns.id}) LIKE ${searchPattern}
        OR lower(${historyRuns.action}) LIKE ${searchPattern}
        OR lower(${historyRuns.trigger}) LIKE ${searchPattern}
        OR lower(COALESCE(${historyRuns.message}, '')) LIKE ${searchPattern}
        OR EXISTS (
          SELECT 1
          FROM history_events events
          WHERE events.run_id = history_runs.id
            AND lower(events.message) LIKE ${searchPattern}
        )
      )
    `);
  }

  if (filters.action) {
    whereClauses.push(eq(historyRuns.action, filters.action));
  }

  if (filters.trigger) {
    whereClauses.push(eq(historyRuns.trigger, filters.trigger));
  }

  const filteredWhereClauses = whereClauses.filter(Boolean);
  const rows = db.select({
    id: historyRuns.id,
    trigger: historyRuns.trigger,
    action: historyRuns.action,
    status: historyRuns.status,
    message: historyRuns.message,
    summaryJson: historyRuns.summaryJson,
    startedAt: historyRuns.startedAt,
    finishedAt: historyRuns.finishedAt,
    eventCount: sql<number>`(
      SELECT COUNT(*)
      FROM history_events events
      WHERE events.run_id = history_runs.id
    )`.mapWith(Number),
  })
    .from(historyRuns)
    .where(filteredWhereClauses.length > 0 ? and(...filteredWhereClauses) : undefined)
    .orderBy(desc(historyRuns.startedAt), desc(historyRuns.id))
    .limit(limit)
    .all();

  return rows.map(mapRunRow);
}

export async function getHistoryRunDetails(runId: string): Promise<HistoryRunDetails | null> {
  ensureHistoryStorage();

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
    eventCount: sql<number>`(
      SELECT COUNT(*)
      FROM history_events events
      WHERE events.run_id = history_runs.id
    )`.mapWith(Number),
  })
    .from(historyRuns)
    .where(eq(historyRuns.id, runId))
    .get();

  if (!runRow) {
    return null;
  }

  const eventOrderingRank = sql<number>`
    CASE
      WHEN ${historyEvents.message} LIKE '% step success.'
        OR ${historyEvents.message} LIKE '% step partial.'
        OR ${historyEvents.message} LIKE '% step skipped.'
        OR ${historyEvents.message} LIKE '% step failed.'
        OR ${historyEvents.message} LIKE '% step failure.'
      THEN 1
      ELSE 0
    END
  `;

  const eventRows = db.select({
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
    .orderBy(
      asc(historyEvents.createdAt),
      asc(eventOrderingRank),
      sql`rowid ASC`,
    )
    .all();

  return {
    run: mapRunRow(runRow),
    events: eventRows.map(mapEventRow),
  };
}

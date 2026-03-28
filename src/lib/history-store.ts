import { randomUUID } from 'crypto';
import { config } from './config';
import { sqlite } from './db';

export type HistoryRunTrigger = 'scheduler' | 'manual';
export type HistoryRunAction =
  | 'scheduler_cycle'
  | 'product_sync'
  | 'grocy_to_mealie'
  | 'ensure_low_stock'
  | 'reconcile_in_possession'
  | 'mealie_to_grocy'
  | 'conflict_check'
  | 'clear_sync_locks';
export type HistoryRunStatus = 'success' | 'partial' | 'failure' | 'skipped';
export type HistoryEventLevel = 'info' | 'warning' | 'error';
export type HistoryEventCategory = 'sync' | 'conflict' | 'mapping' | 'notification' | 'lock' | 'system';
export type HistoryEventEntityKind =
  | 'product'
  | 'unit'
  | 'shopping_item'
  | 'conflict'
  | 'lock'
  | 'system'
  | null;

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

let historyStorageReady = false;

function ensureHistoryStorage(): void {
  if (historyStorageReady) {
    return;
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS history_runs (
      id text PRIMARY KEY NOT NULL,
      trigger text NOT NULL,
      action text NOT NULL,
      status text NOT NULL,
      message text,
      summary_json text,
      started_at integer NOT NULL,
      finished_at integer NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_history_runs_started_at
      ON history_runs (started_at DESC);

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
    );

    CREATE INDEX IF NOT EXISTS idx_history_events_run_id
      ON history_events (run_id, created_at);
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
  trigger: HistoryRunTrigger;
  action: HistoryRunAction;
  status: HistoryRunStatus;
  message: string | null;
  summary_json: string | null;
  started_at: number;
  finished_at: number;
  event_count?: number;
}): HistoryRunRecord {
  return {
    id: row.id,
    trigger: row.trigger,
    action: row.action,
    status: row.status,
    message: row.message,
    summary: parseJsonValue(row.summary_json),
    startedAt: new Date(row.started_at),
    finishedAt: new Date(row.finished_at),
    eventCount: Number(row.event_count ?? 0),
  };
}

function mapEventRow(row: {
  id: string;
  run_id: string;
  level: HistoryEventLevel;
  category: HistoryEventCategory;
  entity_kind: HistoryEventEntityKind;
  entity_ref: string | null;
  message: string;
  details_json: string | null;
  created_at: number;
}): HistoryEventRecord {
  return {
    id: row.id,
    runId: row.run_id,
    level: row.level,
    category: row.category,
    entityKind: row.entity_kind,
    entityRef: row.entity_ref,
    message: row.message,
    details: parseJsonValue(row.details_json),
    createdAt: new Date(row.created_at),
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

  const clearHistoryTransaction = sqlite.transaction(() => {
    sqlite.prepare('DELETE FROM history_events').run();
    sqlite.prepare('DELETE FROM history_runs').run();
  });

  clearHistoryTransaction();
}

export async function purgeExpiredHistory(now: Date = new Date()): Promise<number> {
  ensureHistoryStorage();

  const cutoff = getRetentionCutoff(now);
  if (cutoff === null) {
    return 0;
  }

  const staleRunIds = sqlite.prepare(
    'SELECT id FROM history_runs WHERE finished_at < ?',
  ).all(cutoff) as Array<{ id: string }>;

  if (staleRunIds.length === 0) {
    return 0;
  }

  const purgeTransaction = sqlite.transaction((runIds: string[]) => {
    const deleteEventsStatement = sqlite.prepare('DELETE FROM history_events WHERE run_id = ?');
    const deleteRunsStatement = sqlite.prepare('DELETE FROM history_runs WHERE id = ?');

    for (const runId of runIds) {
      deleteEventsStatement.run(runId);
      deleteRunsStatement.run(runId);
    }
  });

  purgeTransaction(staleRunIds.map(({ id }) => id));
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

  const insertRunTransaction = sqlite.transaction(() => {
    sqlite.prepare(`
      INSERT INTO history_runs (
        id,
        trigger,
        action,
        status,
        message,
        summary_json,
        started_at,
        finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      runId,
      input.trigger,
      input.action,
      input.status,
      input.message ?? null,
      summaryJson,
      input.startedAt.getTime(),
      input.finishedAt.getTime(),
    );

    const insertEventStatement = sqlite.prepare(`
      INSERT INTO history_events (
        id,
        run_id,
        level,
        category,
        entity_kind,
        entity_ref,
        message,
        details_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const event of events) {
      insertEventStatement.run(
        randomUUID(),
        runId,
        event.level,
        event.category,
        event.entityKind ?? null,
        event.entityRef ?? null,
        event.message,
        serializeJsonValue(event.details),
        input.finishedAt.getTime(),
      );
    }
  });

  insertRunTransaction();
  await purgeExpiredHistory(now);

  return runId;
}

export async function listHistoryRuns(limit = 100): Promise<HistoryRunRecord[]> {
  ensureHistoryStorage();

  if (!config.historyEnabled) {
    return [];
  }

  const rows = sqlite.prepare(`
    SELECT
      runs.*,
      (
        SELECT COUNT(*)
        FROM history_events events
        WHERE events.run_id = runs.id
      ) AS event_count
    FROM history_runs runs
    ORDER BY runs.started_at DESC, runs.id DESC
    LIMIT ?
  `).all(limit) as Array<{
    id: string;
    trigger: HistoryRunTrigger;
    action: HistoryRunAction;
    status: HistoryRunStatus;
    message: string | null;
    summary_json: string | null;
    started_at: number;
    finished_at: number;
    event_count: number;
  }>;

  return rows.map(mapRunRow);
}

export async function getHistoryRunDetails(runId: string): Promise<HistoryRunDetails | null> {
  ensureHistoryStorage();

  if (!config.historyEnabled) {
    return null;
  }

  const runRow = sqlite.prepare(`
    SELECT
      runs.*,
      (
        SELECT COUNT(*)
        FROM history_events events
        WHERE events.run_id = runs.id
      ) AS event_count
    FROM history_runs runs
    WHERE runs.id = ?
  `).get(runId) as {
    id: string;
    trigger: HistoryRunTrigger;
    action: HistoryRunAction;
    status: HistoryRunStatus;
    message: string | null;
    summary_json: string | null;
    started_at: number;
    finished_at: number;
    event_count: number;
  } | undefined;

  if (!runRow) {
    return null;
  }

  const eventRows = sqlite.prepare(`
    SELECT *
    FROM history_events
    WHERE run_id = ?
    ORDER BY
      created_at ASC,
      CASE
        WHEN message LIKE '% step success.'
          OR message LIKE '% step partial.'
          OR message LIKE '% step skipped.'
          OR message LIKE '% step failed.'
          OR message LIKE '% step failure.'
        THEN 1
        ELSE 0
      END ASC,
      _rowid_ ASC
  `).all(runId) as Array<{
    id: string;
    run_id: string;
    level: HistoryEventLevel;
    category: HistoryEventCategory;
    entity_kind: HistoryEventEntityKind;
    entity_ref: string | null;
    message: string;
    details_json: string | null;
    created_at: number;
  }>;

  return {
    run: mapRunRow(runRow),
    events: eventRows.map(mapEventRow),
  };
}

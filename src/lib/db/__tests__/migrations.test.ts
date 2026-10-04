import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, describe, expect, it } from 'vitest';

const BROKEN_MIGRATION_CREATED_AT = [
  1774077759378,
  1774886400000,
  1774886400001,
];

function getSqliteObjectSql(dbPath: string, name: string): string | null {
  const sqlite = new Database(dbPath);
  try {
    const row = sqlite.prepare(
      "SELECT sql FROM sqlite_master WHERE name = ?",
    ).get(name) as { sql: string | null } | undefined;

    return row?.sql ?? null;
  } finally {
    sqlite.close();
  }
}

function readDrizzleJournal(): { entries: Array<{ idx: number; tag: string; when: number }> } {
  return JSON.parse(fs.readFileSync(path.resolve('drizzle/meta/_journal.json'), 'utf8')) as {
    entries: Array<{ idx: number; tag: string; when: number }>;
  };
}

describe('SQLite migrations', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (tempDir) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  });

  it('upgrades existing history without losing manual changes or exposing routine sync summaries', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gms-history-upgrade-'));
    tempDirs.push(tempDir);
    const journal = readDrizzleJournal();
    const oldEntries = journal.entries.filter(entry => entry.idx < 10);
    fs.mkdirSync(path.join(tempDir, 'meta'));
    fs.writeFileSync(path.join(tempDir, 'meta/_journal.json'), JSON.stringify({ version: '7', dialect: 'sqlite', entries: oldEntries }));
    for (const entry of oldEntries) fs.copyFileSync(path.resolve(`drizzle/${entry.tag}.sql`), path.join(tempDir, `${entry.tag}.sql`));
    const sqlite = new Database(':memory:');
    try {
      const db = drizzle(sqlite);
      migrate(db, { migrationsFolder: tempDir });
      sqlite.exec(`
        INSERT INTO history_runs (id, trigger, action, status, started_at, finished_at) VALUES
          ('manual', 'manual', 'inventory_add_stock', 'success', 1, 2),
          ('sync', 'scheduler', 'scheduler_cycle', 'partial', 1, 2),
          ('conflict-check', 'manual', 'conflict_check', 'success', 1, 2),
          ('cleanup', 'manual', 'shopping_cleanup', 'success', 1, 2),
          ('shopping', 'manual', 'shopping_remove_item', 'success', 1, 2);
        INSERT INTO history_events (id, run_id, level, category, entity_kind, message, details_json, created_at) VALUES
          ('purchase', 'manual', 'info', 'inventory', 'product', 'Added stock.', '{"name":"Milk"}', 2),
          ('quiet', 'sync', 'info', 'sync', NULL, 'Sync completed.', NULL, 2),
          ('backlog', 'sync', 'warning', 'sync', NULL, 'Grocy to Mealie: Sync completed.', NULL, 2),
          ('conflict-step', 'sync', 'warning', 'conflict', NULL, 'Conflict check step partial.', NULL, 2),
          ('conflict-summary', 'conflict-check', 'info', 'conflict', NULL, 'Completed. Open conflicts: none.', NULL, 2),
          ('cleanup-summary', 'cleanup', 'info', 'shopping', NULL, 'Cleanup completed.', '{"removedItems":0}', 2),
          ('shopping-write', 'shopping', 'info', 'shopping', 'shopping_item', 'Removed Milk.', '{"foodName":"Milk"}', 2),
          ('step-failure', 'sync', 'error', 'sync', NULL, 'Grocy to Mealie step failed.', '{"error":"API failed"}', 2),
          ('failure', 'sync', 'error', 'sync', NULL, 'API failed.', 'invalid legacy JSON', 2);
      `);
      migrate(db, { migrationsFolder: path.resolve('drizzle') });
      expect(sqlite.prepare('SELECT id, kind, product_name FROM history_events ORDER BY id').all()).toEqual([
        { id: 'backlog', kind: 'diagnostic', product_name: null },
        { id: 'cleanup-summary', kind: 'diagnostic', product_name: null },
        { id: 'conflict-step', kind: 'diagnostic', product_name: null },
        { id: 'conflict-summary', kind: 'diagnostic', product_name: null },
        { id: 'failure', kind: 'issue', product_name: null },
        { id: 'purchase', kind: 'mutation', product_name: 'Milk' },
        { id: 'quiet', kind: 'diagnostic', product_name: null },
        { id: 'shopping-write', kind: 'mutation', product_name: 'Milk' },
        { id: 'step-failure', kind: 'issue', product_name: null },
      ]);
      expect(sqlite.prepare('SELECT count(*) AS count FROM history_runs').get()).toEqual({ count: 5 });
      expect(sqlite.prepare('SELECT created_at FROM history_events WHERE id = ?').get('purchase')).toEqual({ created_at: 2000 });
    } finally {
      sqlite.close();
    }
  });

  it('repairs databases that skipped later schema migrations because of out-of-order journal timestamps', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gms-migrate-'));
    tempDirs.push(tempDir);

    const dbPath = path.join(tempDir, 'sync.db');
    const sqlite = new Database(dbPath);

    sqlite.exec(`
      CREATE TABLE "__drizzle_migrations" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash text NOT NULL,
        created_at numeric
      );

      CREATE TABLE "product_mappings" (
        id text PRIMARY KEY NOT NULL,
        mealie_food_id text NOT NULL,
        mealie_food_name text NOT NULL,
        grocy_product_id integer NOT NULL,
        grocy_product_name text NOT NULL,
        unit_mapping_id text,
        created_at integer NOT NULL,
        updated_at integer NOT NULL
      );

      CREATE UNIQUE INDEX "idx_product_mappings_mealie_food_id"
        ON "product_mappings" ("mealie_food_id");

      CREATE TABLE "sync_state" (
        id text PRIMARY KEY NOT NULL,
        state_data text NOT NULL
      );

      CREATE TABLE "unit_mappings" (
        id text PRIMARY KEY NOT NULL,
        mealie_unit_id text NOT NULL,
        mealie_unit_name text NOT NULL,
        mealie_unit_abbreviation text NOT NULL,
        grocy_unit_id integer NOT NULL,
        grocy_unit_name text NOT NULL,
        conversion_factor real NOT NULL,
        created_at integer NOT NULL,
        updated_at integer NOT NULL
      );

      CREATE UNIQUE INDEX "idx_unit_mappings_mealie_unit_id"
        ON "unit_mappings" ("mealie_unit_id");
    `);

    const insertMigration = sqlite.prepare(
      'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)',
    );

    insertMigration.run('migration-0000', BROKEN_MIGRATION_CREATED_AT[0]);
    insertMigration.run('migration-0001', BROKEN_MIGRATION_CREATED_AT[1]);
    insertMigration.run('migration-0002', BROKEN_MIGRATION_CREATED_AT[2]);
    sqlite.close();

    const db = drizzle(new Database(dbPath));
    migrate(db, { migrationsFolder: path.resolve('drizzle') });

    expect(getSqliteObjectSql(dbPath, 'runtime_locks')).toContain('CREATE TABLE `runtime_locks`');
    expect(getSqliteObjectSql(dbPath, 'idx_product_mappings_grocy_product_id')).toContain('CREATE UNIQUE INDEX');
    expect(getSqliteObjectSql(dbPath, 'idx_unit_mappings_grocy_unit_id')).toContain('CREATE UNIQUE INDEX');
    expect(getSqliteObjectSql(dbPath, 'mapping_conflicts')).toContain('CREATE TABLE `mapping_conflicts`');
    expect(getSqliteObjectSql(dbPath, 'idx_mapping_conflicts_conflict_key')).toContain('CREATE UNIQUE INDEX');
    expect(getSqliteObjectSql(dbPath, 'history_runs')).toContain('CREATE TABLE `history_runs`');
    expect(getSqliteObjectSql(dbPath, 'history_events')).toContain('CREATE TABLE `history_events`');
  });

  it('keeps post-repair drizzle journal timestamps strictly increasing in migration order', () => {
    const journal = readDrizzleJournal();
    const tailStartIndex = journal.entries.findIndex(entry => entry.tag === '0006_steady_sentry');

    expect(tailStartIndex).toBeGreaterThanOrEqual(0);

    for (let index = tailStartIndex + 1; index < journal.entries.length; index += 1) {
      const previous = journal.entries[index - 1];
      const current = journal.entries[index];

      expect(current.when).toBeGreaterThan(previous.when);
      expect(current.idx).toBe(index);
    }
  });
});

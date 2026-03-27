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

    expect(getSqliteObjectSql(dbPath, 'mapping_conflicts')).toContain('CREATE TABLE `mapping_conflicts`');
    expect(getSqliteObjectSql(dbPath, 'idx_mapping_conflicts_conflict_key')).toContain('CREATE UNIQUE INDEX');
  });
});

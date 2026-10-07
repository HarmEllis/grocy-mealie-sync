import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, describe, expect, it } from 'vitest';

const SHOP_TABLES = [
  'plugin_installations', 'app_meta', 'check_lifecycles', 'shop_effects', 'demands', 'demand_revisions',
  'retailer_products', 'retailer_mappings', 'retailer_suggestions', 'shop_exports', 'shop_export_allocations',
  'shop_list_lines', 'receipts', 'receipt_lines', 'reconciliation_links', 'discrepancies', 'receipt_cursors',
  'low_stock_accounted_restocks', 'shop_catalog_searches',
];

describe('shop plugin migrations', () => {
  const tempDirs: string[] = [];
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('upgrades a pre-plugin database without touching existing sync data', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gms-shop-upgrade-'));
    tempDirs.push(tempDir);
    const journal = JSON.parse(fs.readFileSync(path.resolve('drizzle/meta/_journal.json'), 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    const oldEntries = journal.entries.filter(entry => entry.idx <= 10);
    fs.mkdirSync(path.join(tempDir, 'meta'));
    fs.writeFileSync(path.join(tempDir, 'meta/_journal.json'), JSON.stringify({ version: '7', dialect: 'sqlite', entries: oldEntries }));
    for (const entry of oldEntries) fs.copyFileSync(path.resolve(`drizzle/${entry.tag}.sql`), path.join(tempDir, `${entry.tag}.sql`));

    const sqlite = new Database(':memory:');
    try {
      const db = drizzle(sqlite);
      migrate(db, { migrationsFolder: tempDir });
      sqlite.exec(`
        INSERT INTO product_mappings (id, mealie_food_id, mealie_food_name, grocy_product_id, grocy_product_name, created_at, updated_at)
          VALUES ('m1', 'food-1', 'Milk', 101, 'Milk', 1, 1);
        INSERT INTO sync_state (id, state_data) VALUES ('singleton', '{"grocyBelowMinStock":{"101":2},"mealieSubRestockProgress":{"row":[5]}}');
        INSERT INTO runtime_locks (name, owner_id, expires_at) VALUES ('scheduler-startup', 'owner', 1);
      `);
      for (const table of SHOP_TABLES) {
        expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)).toBeUndefined();
      }

      migrate(db, { migrationsFolder: path.resolve('drizzle') });

      for (const table of SHOP_TABLES) {
        expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)).toEqual({ name: table });
        expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()).toEqual({ count: 0 });
      }
      expect(sqlite.prepare('SELECT grocy_product_id FROM product_mappings').all()).toEqual([{ grocy_product_id: 101 }]);
      expect(JSON.parse((sqlite.prepare('SELECT state_data FROM sync_state').get() as { state_data: string }).state_data))
        .toEqual({ grocyBelowMinStock: { 101: 2 }, mealieSubRestockProgress: { row: [5] } });
      expect(sqlite.prepare('SELECT name FROM runtime_locks').all()).toEqual([{ name: 'scheduler-startup' }]);
      // Receipts are deduplicated per retailer account, not per installation.
      const receiptIndex = sqlite.prepare("SELECT sql FROM sqlite_master WHERE name = 'idx_receipts_provider_account_external'").get() as { sql: string };
      expect(receiptIndex.sql).toContain('`provider_id`,`account_key`,`external_receipt_id`');
    } finally {
      sqlite.close();
    }
  });

  it('upgrades the rc.1 schema while preserving existing retailer products and shopping demand', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gms-catalog-upgrade-'));
    tempDirs.push(tempDir);
    const journal = JSON.parse(fs.readFileSync(path.resolve('drizzle/meta/_journal.json'), 'utf8'));
    const entries = journal.entries.filter((entry: { idx: number }) => entry.idx <= 15);
    fs.mkdirSync(path.join(tempDir, 'meta'));
    fs.writeFileSync(path.join(tempDir, 'meta/_journal.json'), JSON.stringify({ ...journal, entries }));
    for (const entry of entries) fs.copyFileSync(path.resolve(`drizzle/${entry.tag}.sql`), path.join(tempDir, `${entry.tag}.sql`));
    const sqlite = new Database(':memory:');
    try {
      const database = drizzle(sqlite);
      migrate(database, { migrationsFolder: tempDir });
      sqlite.exec(`INSERT INTO retailer_products (id, provider_id, external_id, name, measure, last_seen_at) VALUES ('ah:123', 'ah', '123', 'Synthetic tomatoes', 'unit', 1);
        INSERT INTO demands (mealie_item_id, shopping_list_id, status, first_seen_at) VALUES ('row', 'list', 'open', 1);`);
      migrate(database, { migrationsFolder: path.resolve('drizzle') });
      expect(sqlite.prepare('SELECT name FROM retailer_products').all()).toEqual([{ name: 'Synthetic tomatoes' }]);
      expect(sqlite.prepare('SELECT mealie_item_id, status FROM demands').all()).toEqual([{ mealie_item_id: 'row', status: 'open' }]);
      expect(sqlite.prepare('SELECT COUNT(*) AS count FROM shop_catalog_searches').get()).toEqual({ count: 0 });
    } finally { sqlite.close(); }
  });

});

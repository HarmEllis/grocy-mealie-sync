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
  'low_stock_accounted_restocks',
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
});

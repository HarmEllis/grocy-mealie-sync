import path from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@/lib/db/schema';

/**
 * In-memory SQLite database with all real migrations applied. Tests mock
 * `@/lib/db` with this so they never open the database under ./data.
 */
export function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  return db;
}

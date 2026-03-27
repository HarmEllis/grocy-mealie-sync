import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import fs from 'fs';
import path from 'path';

/** Allowed parent directories for the database file. */
const ALLOWED_DB_DIRS = ['./data', '/app/data'];

export function validateDatabasePath(raw: string): string {
  const resolved = path.resolve(raw);
  const isAllowed = ALLOWED_DB_DIRS.some((dir) => {
    const allowedResolved = path.resolve(dir);
    // Ensure the resolved path starts with an allowed directory
    return resolved.startsWith(allowedResolved + path.sep) || resolved === allowedResolved;
  });

  if (!isAllowed) {
    throw new Error(
      `DATABASE_PATH "${raw}" resolves to "${resolved}" which is outside the allowed directories (${ALLOWED_DB_DIRS.join(', ')}). ` +
      'This is a security restriction to prevent path traversal.',
    );
  }

  return resolved;
}

const rawDbPath = process.env.DATABASE_PATH || './data/sync.db';
const dbPath = validateDatabasePath(rawDbPath);
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });

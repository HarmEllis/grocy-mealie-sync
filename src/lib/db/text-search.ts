import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';

/** Literal, case-insensitive substring search with bound values, including '%' and '_'. */
export function containsText(columns: SQLWrapper[], search: string): SQL {
  const text = sql.join(columns.map(column => sql`coalesce(${column}, '')`), sql` || ' ' || `);
  return sql`instr(lower(${text}), lower(${search})) > 0`;
}

/**
 * Limits shared by the bulk mapping-wizard endpoints and their client callers.
 *
 * Deliberately dependency-free: `src/lib/validation.ts` pulls in Zod, and client
 * bundles should not import a schema module just to read a number.
 */

/**
 * Maximum number of ids accepted in a single bulk request body.
 *
 * The client chunks below this; the server still enforces it, because a request
 * carrying thousands of ids means a single sequential upstream loop long enough
 * to outlive its own sync-lock lease.
 */
export const BULK_MAX_ITEMS = 500;

/** One upstream write plus one DB insert per item — the slowest operation. */
export const CHUNK_SIZE_CREATE = 200;

/** DB upsert plus an occasional rename. */
export const CHUNK_SIZE_SYNC = 500;

/** Destructive: keep the blast radius of a single failed chunk small. */
export const CHUNK_SIZE_DELETE = 100;

import { log } from '../logger';

/** Diagnostic snapshots are disposable; corrupt data must not block shopping work. */
export function parseStoredJson<T>(value: string | undefined, fallback: T): T {
  if (value === undefined) return fallback;
  try {
    const parsed = JSON.parse(value);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed) !== Array.isArray(fallback)) return fallback;
    return parsed as T;
  } catch {
    log.warn('[Shop] Ignoring invalid stored diagnostic JSON.');
    return fallback;
  }
}

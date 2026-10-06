import type { ERROR_CODES } from './protocol/v1.ts';

/** Only put safe, user-facing text in this error; never include upstream response bodies or tokens. */
export class AdapterError extends Error {
  readonly code: typeof ERROR_CODES[number];
  readonly outcome: 'not_applied' | 'unknown';
  readonly retryable: boolean;
  constructor(code: typeof ERROR_CODES[number], message: string, outcome: 'not_applied' | 'unknown' = 'not_applied', retryable = false) {
    super(message);
    this.code = code;
    this.outcome = outcome;
    this.retryable = retryable;
  }
}

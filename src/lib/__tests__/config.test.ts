import { describe, it, expect } from 'vitest';
import {
  parseBooleanEnv,
  parseCleanupCheckedItemsAfterHoursEnv,
  parseCleanupCheckedItemsModeEnv,
  parseHistoryRetentionDaysEnv,
  parseIntOrDefault,
  parseOptionalIntEnv,
  parseOptionalUrlEnv,
  parseTimeZoneEnv,
  parseWebhookModeEnv,
  resolveLocaleForConfiguredTimeZone,
  validateServiceUrl,
} from '../config';

describe('parseIntOrDefault', () => {
  it('returns number for valid input', () => {
    expect(parseIntOrDefault('60', 30)).toBe(60);
    expect(parseIntOrDefault('0', 30)).toBe(0);
    expect(parseIntOrDefault('1', 99)).toBe(1);
  });

  it('falls back to default for NaN', () => {
    expect(parseIntOrDefault(undefined, 60)).toBe(60);
    expect(parseIntOrDefault('', 60)).toBe(60);
    expect(parseIntOrDefault('abc', 60)).toBe(60);
    expect(parseIntOrDefault('NaN', 60)).toBe(60);
  });

  it('handles negative numbers', () => {
    expect(parseIntOrDefault('-1', 0)).toBe(-1);
  });

  it('truncates floats', () => {
    expect(parseIntOrDefault('3.14', 0)).toBe(3);
  });
});

describe('validateServiceUrl', () => {
  it('accepts valid http URLs', () => {
    expect(validateServiceUrl('http://localhost:9000', 'TEST', 'http://default')).toBe('http://localhost:9000');
    expect(validateServiceUrl('https://grocy.example.com', 'TEST', 'http://default')).toBe('https://grocy.example.com');
  });

  it('rejects invalid URLs and returns default', () => {
    expect(validateServiceUrl(undefined, 'TEST', 'http://default')).toBe('http://default');
    expect(validateServiceUrl('', 'TEST', 'http://default')).toBe('http://default');
    expect(validateServiceUrl('ftp://bad', 'TEST', 'http://default')).toBe('http://default');
    expect(validateServiceUrl('not-a-url', 'TEST', 'http://default')).toBe('http://default');
  });

  it('trims whitespace', () => {
    expect(validateServiceUrl('  http://trimmed  ', 'TEST', 'http://default')).toBe('http://trimmed');
  });

  it('rejects whitespace-only strings', () => {
    expect(validateServiceUrl('   ', 'TEST', 'http://default')).toBe('http://default');
  });
});

describe('parseOptionalIntEnv', () => {
  it('returns null for empty values', () => {
    expect(parseOptionalIntEnv(undefined, 'TEST')).toBeNull();
    expect(parseOptionalIntEnv('', 'TEST')).toBeNull();
    expect(parseOptionalIntEnv('   ', 'TEST')).toBeNull();
  });

  it('parses configured integers', () => {
    expect(parseOptionalIntEnv('3', 'TEST')).toBe(3);
    expect(parseOptionalIntEnv(' 42 ', 'TEST')).toBe(42);
  });

  it('returns null for invalid integers', () => {
    expect(parseOptionalIntEnv('abc', 'TEST')).toBeNull();
  });
});

describe('parseBooleanEnv', () => {
  it('returns the default for empty values', () => {
    expect(parseBooleanEnv(undefined, false, 'TEST')).toBe(false);
    expect(parseBooleanEnv('', true, 'TEST')).toBe(true);
  });

  it('parses supported boolean values', () => {
    expect(parseBooleanEnv('true', false, 'TEST')).toBe(true);
    expect(parseBooleanEnv('TRUE', false, 'TEST')).toBe(true);
    expect(parseBooleanEnv('1', false, 'TEST')).toBe(true);
    expect(parseBooleanEnv('false', true, 'TEST')).toBe(false);
    expect(parseBooleanEnv('0', true, 'TEST')).toBe(false);
  });

  it('falls back to the default for invalid values', () => {
    expect(parseBooleanEnv('yes', false, 'TEST')).toBe(false);
    expect(parseBooleanEnv('nope', true, 'TEST')).toBe(true);
  });
});

describe('parseOptionalUrlEnv', () => {
  it('returns null for empty values', () => {
    expect(parseOptionalUrlEnv(undefined, 'TEST')).toBeNull();
    expect(parseOptionalUrlEnv('', 'TEST')).toBeNull();
  });

  it('accepts valid http and https URLs', () => {
    expect(parseOptionalUrlEnv('http://example.test/ping', 'TEST')).toBe('http://example.test/ping');
    expect(parseOptionalUrlEnv('https://example.test/hook', 'TEST')).toBe('https://example.test/hook');
  });

  it('rejects invalid URLs', () => {
    expect(parseOptionalUrlEnv('ftp://example.test', 'TEST')).toBeNull();
    expect(parseOptionalUrlEnv('not-a-url', 'TEST')).toBeNull();
  });
});

describe('parseWebhookModeEnv', () => {
  it('defaults to errors_only', () => {
    expect(parseWebhookModeEnv(undefined, 'TEST')).toBe('errors_only');
  });

  it('accepts supported modes', () => {
    expect(parseWebhookModeEnv('always', 'TEST')).toBe('always');
    expect(parseWebhookModeEnv('errors_only', 'TEST')).toBe('errors_only');
  });

  it('falls back to errors_only for invalid modes', () => {
    expect(parseWebhookModeEnv('sometimes', 'TEST')).toBe('errors_only');
  });
});

describe('parseTimeZoneEnv', () => {
  it('returns null for empty values', () => {
    expect(parseTimeZoneEnv(undefined, 'TZ')).toBeNull();
    expect(parseTimeZoneEnv('', 'TZ')).toBeNull();
  });

  it('accepts valid IANA timezones and canonicalizes casing', () => {
    expect(parseTimeZoneEnv('Europe/Amsterdam', 'TZ')).toBe('Europe/Amsterdam');
    expect(parseTimeZoneEnv('europe/amsterdam', 'TZ')).toBe('Europe/Amsterdam');
  });

  it('returns null for invalid timezones', () => {
    expect(parseTimeZoneEnv('not-a-timezone', 'TZ')).toBeNull();
  });
});

describe('parseHistoryRetentionDaysEnv', () => {
  it('defaults to seven days when unset', () => {
    expect(parseHistoryRetentionDaysEnv(undefined, 'HISTORY_RETENTION_DAYS')).toBe(7);
    expect(parseHistoryRetentionDaysEnv('', 'HISTORY_RETENTION_DAYS')).toBe(7);
  });

  it('accepts -1 to disable history and non-negative retention values', () => {
    expect(parseHistoryRetentionDaysEnv('-1', 'HISTORY_RETENTION_DAYS')).toBe(-1);
    expect(parseHistoryRetentionDaysEnv('0', 'HISTORY_RETENTION_DAYS')).toBe(0);
    expect(parseHistoryRetentionDaysEnv('14', 'HISTORY_RETENTION_DAYS')).toBe(14);
  });

  it('falls back to seven days for invalid values', () => {
    expect(parseHistoryRetentionDaysEnv('-2', 'HISTORY_RETENTION_DAYS')).toBe(7);
    expect(parseHistoryRetentionDaysEnv('abc', 'HISTORY_RETENTION_DAYS')).toBe(7);
  });
});

describe('parseCleanupCheckedItemsAfterHoursEnv', () => {
  it('defaults to -1 (disabled) when unset', () => {
    expect(parseCleanupCheckedItemsAfterHoursEnv(undefined, 'TEST')).toBe(-1);
    expect(parseCleanupCheckedItemsAfterHoursEnv('', 'TEST')).toBe(-1);
    expect(parseCleanupCheckedItemsAfterHoursEnv('   ', 'TEST')).toBe(-1);
  });

  it('accepts -1 to disable and positive integers', () => {
    expect(parseCleanupCheckedItemsAfterHoursEnv('-1', 'TEST')).toBe(-1);
    expect(parseCleanupCheckedItemsAfterHoursEnv('1', 'TEST')).toBe(1);
    expect(parseCleanupCheckedItemsAfterHoursEnv('24', 'TEST')).toBe(24);
    expect(parseCleanupCheckedItemsAfterHoursEnv('48', 'TEST')).toBe(48);
  });

  it('trims whitespace', () => {
    expect(parseCleanupCheckedItemsAfterHoursEnv(' 24 ', 'TEST')).toBe(24);
  });

  it('falls back to -1 for invalid values', () => {
    expect(parseCleanupCheckedItemsAfterHoursEnv('abc', 'TEST')).toBe(-1);
    expect(parseCleanupCheckedItemsAfterHoursEnv('0', 'TEST')).toBe(-1);
    expect(parseCleanupCheckedItemsAfterHoursEnv('-2', 'TEST')).toBe(-1);
  });
});

describe('parseCleanupCheckedItemsModeEnv', () => {
  it('defaults to all when unset', () => {
    expect(parseCleanupCheckedItemsModeEnv(undefined, 'TEST')).toBe('all');
    expect(parseCleanupCheckedItemsModeEnv('', 'TEST')).toBe('all');
  });

  it('accepts valid mode values', () => {
    expect(parseCleanupCheckedItemsModeEnv('all', 'TEST')).toBe('all');
    expect(parseCleanupCheckedItemsModeEnv('synced_only', 'TEST')).toBe('synced_only');
  });

  it('is case-insensitive', () => {
    expect(parseCleanupCheckedItemsModeEnv('ALL', 'TEST')).toBe('all');
    expect(parseCleanupCheckedItemsModeEnv('Synced_Only', 'TEST')).toBe('synced_only');
  });

  it('falls back to all for invalid values', () => {
    expect(parseCleanupCheckedItemsModeEnv('invalid', 'TEST')).toBe('all');
    expect(parseCleanupCheckedItemsModeEnv('none', 'TEST')).toBe('all');
  });
});

describe('resolveLocaleForConfiguredTimeZone', () => {
  it('derives a representative locale from a configured timezone', () => {
    expect(resolveLocaleForConfiguredTimeZone('Europe/Amsterdam')).toBe('nl-NL');
    expect(resolveLocaleForConfiguredTimeZone('America/New_York')).toBe('en-US');
  });

  it('returns null when no timezone is configured', () => {
    expect(resolveLocaleForConfiguredTimeZone(null)).toBeNull();
  });
});

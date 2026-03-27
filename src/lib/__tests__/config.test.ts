import { describe, it, expect } from 'vitest';
import {
  parseBooleanEnv,
  parseIntOrDefault,
  parseOptionalIntEnv,
  parseOptionalUrlEnv,
  parseTimeZoneEnv,
  parseWebhookModeEnv,
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

import { describe, it, expect } from 'vitest';
import { parseIntOrDefault, validateServiceUrl } from '../config';

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

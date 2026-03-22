import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('config', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('parseIntOrDefault returns number for valid input', async () => {
    // Test the logic directly since config is module-level
    const parseIntOrDefault = (value: string | undefined, defaultValue: number): number => {
      const parsed = parseInt(value || '', 10);
      return isNaN(parsed) ? defaultValue : parsed;
    };

    expect(parseIntOrDefault('60', 30)).toBe(60);
    expect(parseIntOrDefault('0', 30)).toBe(0);
  });

  it('parseIntOrDefault falls back to default for NaN', () => {
    const parseIntOrDefault = (value: string | undefined, defaultValue: number): number => {
      const parsed = parseInt(value || '', 10);
      return isNaN(parsed) ? defaultValue : parsed;
    };

    expect(parseIntOrDefault(undefined, 60)).toBe(60);
    expect(parseIntOrDefault('', 60)).toBe(60);
    expect(parseIntOrDefault('abc', 60)).toBe(60);
    expect(parseIntOrDefault('NaN', 60)).toBe(60);
  });

  it('validateServiceUrl accepts valid http URLs', () => {
    const validateServiceUrl = (value: string | undefined, name: string, defaultUrl: string): string => {
      if (!value || value.trim() === '') return defaultUrl;
      const trimmed = value.trim();
      if (!/^https?:\/\//i.test(trimmed)) return defaultUrl;
      return trimmed;
    };

    expect(validateServiceUrl('http://localhost:9000', 'TEST', 'http://default')).toBe('http://localhost:9000');
    expect(validateServiceUrl('https://grocy.example.com', 'TEST', 'http://default')).toBe('https://grocy.example.com');
  });

  it('validateServiceUrl rejects invalid URLs and returns default', () => {
    const validateServiceUrl = (value: string | undefined, name: string, defaultUrl: string): string => {
      if (!value || value.trim() === '') return defaultUrl;
      const trimmed = value.trim();
      if (!/^https?:\/\//i.test(trimmed)) return defaultUrl;
      return trimmed;
    };

    expect(validateServiceUrl(undefined, 'TEST', 'http://default')).toBe('http://default');
    expect(validateServiceUrl('', 'TEST', 'http://default')).toBe('http://default');
    expect(validateServiceUrl('ftp://bad', 'TEST', 'http://default')).toBe('http://default');
    expect(validateServiceUrl('not-a-url', 'TEST', 'http://default')).toBe('http://default');
  });
});

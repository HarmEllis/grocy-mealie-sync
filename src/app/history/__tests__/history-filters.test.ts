import { describe, expect, it } from 'vitest';
import {
  buildHistoryFilterSearchParams,
  resolveHistoryFilters,
  resolveDateRangePreset,
} from '../history-filters';

describe('resolveHistoryFilters', () => {
  it('resolves status filter from search params', () => {
    const result = resolveHistoryFilters({ status: 'failure' });
    expect(result.status).toBe('failure');
    expect(result.hasFilters).toBe(true);
  });

  it('rejects invalid status values', () => {
    const result = resolveHistoryFilters({ status: 'invalid' });
    expect(result.status).toBeNull();
    expect(result.hasFilters).toBe(false);
  });

  it('resolves dateFrom and dateTo from search params', () => {
    const result = resolveHistoryFilters({ dateFrom: '2026-03-20', dateTo: '2026-03-25' });
    expect(result.dateFrom).toBe('2026-03-20');
    expect(result.dateTo).toBe('2026-03-25');
    expect(result.hasFilters).toBe(true);
  });

  it('rejects invalid date format', () => {
    const result = resolveHistoryFilters({ dateFrom: '20-03-2026', dateTo: 'not-a-date' });
    expect(result.dateFrom).toBeNull();
    expect(result.dateTo).toBeNull();
    expect(result.hasFilters).toBe(false);
  });

  it('hasFilters is true when only status is set', () => {
    const result = resolveHistoryFilters({ status: 'success' });
    expect(result.hasFilters).toBe(true);
  });

  it('hasFilters is true when only dateFrom is set', () => {
    const result = resolveHistoryFilters({ dateFrom: '2026-03-20' });
    expect(result.hasFilters).toBe(true);
  });

  it('returns all null filters for empty params', () => {
    const result = resolveHistoryFilters(undefined);
    expect(result).toEqual({
      search: '',
      action: null,
      trigger: null,
      status: null,
      dateFrom: null,
      dateTo: null,
      hasFilters: false,
    });
  });
});

describe('buildHistoryFilterSearchParams', () => {
  it('builds search params with status, dateFrom, dateTo', () => {
    const result = buildHistoryFilterSearchParams(new URLSearchParams(), {
      search: '',
      action: null,
      trigger: null,
      status: 'failure',
      dateFrom: '2026-03-20',
      dateTo: '2026-03-25',
    });
    const params = new URLSearchParams(result);
    expect(params.get('status')).toBe('failure');
    expect(params.get('dateFrom')).toBe('2026-03-20');
    expect(params.get('dateTo')).toBe('2026-03-25');
  });

  it('clears status, dateFrom, dateTo when null', () => {
    const existing = new URLSearchParams('status=success&dateFrom=2026-03-20&dateTo=2026-03-25');
    const result = buildHistoryFilterSearchParams(existing, {
      search: '',
      action: null,
      trigger: null,
      status: null,
      dateFrom: null,
      dateTo: null,
    });
    const params = new URLSearchParams(result);
    expect(params.has('status')).toBe(false);
    expect(params.has('dateFrom')).toBe(false);
    expect(params.has('dateTo')).toBe(false);
  });

  it('rejects invalid status in build', () => {
    const result = buildHistoryFilterSearchParams(new URLSearchParams(), {
      search: '',
      action: null,
      trigger: null,
      status: 'bogus',
      dateFrom: null,
      dateTo: null,
    });
    const params = new URLSearchParams(result);
    expect(params.has('status')).toBe(false);
  });

  it('rejects invalid date format in build', () => {
    const result = buildHistoryFilterSearchParams(new URLSearchParams(), {
      search: '',
      action: null,
      trigger: null,
      status: null,
      dateFrom: 'not-valid',
      dateTo: '2026-13-99',
    });
    const params = new URLSearchParams(result);
    expect(params.has('dateFrom')).toBe(false);
    // Note: regex only checks format, not calendar validity — '2026-13-99' passes the pattern
    expect(params.has('dateTo')).toBe(true);
  });
});

describe('resolveDateRangePreset', () => {
  const referenceDate = new Date('2026-03-25T12:00:00.000Z');

  it('returns today dates for today preset', () => {
    expect(resolveDateRangePreset('today', referenceDate)).toEqual({
      from: '2026-03-25',
      to: '2026-03-25',
    });
  });

  it('returns yesterday dates for yesterday preset', () => {
    expect(resolveDateRangePreset('yesterday', referenceDate)).toEqual({
      from: '2026-03-24',
      to: '2026-03-24',
    });
  });

  it('returns 7-day range for last_7_days preset', () => {
    expect(resolveDateRangePreset('last_7_days', referenceDate)).toEqual({
      from: '2026-03-18',
      to: '2026-03-25',
    });
  });

  it('returns 30-day range for last_30_days preset', () => {
    expect(resolveDateRangePreset('last_30_days', referenceDate)).toEqual({
      from: '2026-02-23',
      to: '2026-03-25',
    });
  });
});

import { describe, expect, it } from 'vitest';
import { buildHistoryFilterSearchParams, resolveHistoryFilters } from './history-filters';

describe('history filters', () => {
  it('normalizes valid search, action, and trigger filters', () => {
    expect(resolveHistoryFilters({
      q: '  settings  ',
      action: 'settings_update',
      trigger: 'manual',
    })).toEqual({
      search: 'settings',
      action: 'settings_update',
      trigger: 'manual',
      hasFilters: true,
    });
  });

  it('drops invalid action and trigger filters', () => {
    expect(resolveHistoryFilters({
      q: undefined,
      action: 'invalid_action',
      trigger: 'invalid_trigger',
    })).toEqual({
      search: '',
      action: null,
      trigger: null,
      hasFilters: false,
    });
  });

  it('builds search params for live filter updates and removes empty values', () => {
    const searchParams = new URLSearchParams('page=2&q=old&action=settings_update&trigger=manual');

    expect(buildHistoryFilterSearchParams(searchParams, {
      search: '  stock  ',
      action: '',
      trigger: 'scheduler',
    })).toBe('page=2&q=stock&trigger=scheduler');
  });

  it('keeps unrelated params when all history filters are cleared', () => {
    const searchParams = new URLSearchParams('page=2&q=old&action=settings_update&trigger=manual');

    expect(buildHistoryFilterSearchParams(searchParams, {
      search: '   ',
      action: '',
      trigger: '',
    })).toBe('page=2');
  });
});

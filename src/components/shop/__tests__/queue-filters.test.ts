import { describe, expect, it } from 'vitest';
import { queueFilters } from '../products/types';

describe('queueFilters', () => {
  it('maps each tab to the server filter that keeps totals and pages correct', () => {
    expect(queueFilters('todo', 'all')).toEqual({ mapped: 'unmapped', attention: '' });
    expect(queueFilters('mapped', 'all')).toEqual({ mapped: 'mapped', attention: '' });
    expect(queueFilters('attention', 'all')).toEqual({ mapped: 'all', attention: 'any' });
  });

  it('lets a specific status narrow by that reason within any tab', () => {
    expect(queueFilters('mapped', 'unit_changed')).toEqual({ mapped: 'mapped', attention: 'unit_changed' });
    expect(queueFilters('attention', 'discontinued')).toEqual({ mapped: 'all', attention: 'discontinued' });
    expect(queueFilters('todo', 'unconfirmed')).toEqual({ mapped: 'unmapped', attention: 'unconfirmed' });
  });
});

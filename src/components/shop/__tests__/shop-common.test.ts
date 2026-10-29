import { describe, expect, it } from 'vitest';
import { attentionCount, blockedProjectionRows, PROJECTION_FIX, projectionSearchTerm, receiptCheckWindow } from '../shop-common';
import type { ShopOverview } from '@/lib/shop/overview';

function overview(overrides: Partial<ShopOverview>): ShopOverview {
  return {
    installations: [], exports: [], lines: [], receipts: [], review: [], effects: [], discrepancies: [],
    recentChecks: [], openDemand: [], projectionReview: [], ...overrides,
  } as unknown as ShopOverview;
}

describe('attentionCount', () => {
  it('is zero without data and for an empty overview', () => {
    expect(attentionCount(null)).toBe(0);
    expect(attentionCount(overview({}))).toBe(0);
  });

  it('sums review lines, discrepancies, writes and paused lines, ignoring released lines', () => {
    const lines = [
      { pausedReason: 'reduced_by_other' }, { pausedReason: 'released' }, { pausedReason: null },
    ] as unknown as ShopOverview['lines'];
    const result = attentionCount(overview({
      review: [{}, {}] as unknown as ShopOverview['review'],
      discrepancies: [{}] as unknown as ShopOverview['discrepancies'],
      effects: [{}] as unknown as ShopOverview['effects'],
      lines,
    }));
    expect(result).toBe(5);
  });
});

describe('blockedProjectionRows', () => {
  const rows = (reasons: string[]) => reasons.map((reason, index) => ({ installationId: 'i', revisionId: `r${index}`, label: reason, reason })) as unknown as ShopOverview['projectionReview'];

  it('ignores rows that only wait for a mapping and keeps actionable ones', () => {
    const data = overview({ projectionReview: rows(['no_food', 'no_retailer_mapping', 'mapping_unconfirmed', 'no_conversion', 'missing_unit']) });
    expect(blockedProjectionRows(data).map(row => row.reason)).toEqual(['mapping_unconfirmed', 'no_conversion', 'missing_unit']);
  });

  it('feeds the attention count', () => {
    expect(attentionCount(overview({ projectionReview: rows(['no_food', 'mapping_unconfirmed']) }))).toBe(1);
    expect(attentionCount(overview({ projectionReview: rows(['no_retailer_mapping']) }))).toBe(0);
  });
});

describe('receiptCheckWindow', () => {
  it('picks the latest past check and the earliest upcoming check', () => {
    const status = { lastJob: null, nextProcessingAt: null, receipts: [
      { lastCheckedAt: '2026-10-28T08:00:00Z', nextCheckAt: '2026-10-28T10:30:00Z' },
      { lastCheckedAt: '2026-10-28T09:00:00Z', nextCheckAt: '2026-10-28T10:00:00Z' },
      { lastCheckedAt: null, nextCheckAt: null },
    ] } as unknown as Parameters<typeof receiptCheckWindow>[0];
    expect(receiptCheckWindow(status)).toEqual({ last: '2026-10-28T09:00:00Z', next: '2026-10-28T10:00:00Z' });
  });

  it('returns nulls when nothing was ever checked', () => {
    expect(receiptCheckWindow({ lastJob: null, nextProcessingAt: null, receipts: [] })).toEqual({ last: null, next: null });
  });
});

describe('projection fix links', () => {
  it('searches sub-product rows by their product and plain rows by their label', () => {
    expect(projectionSearchTerm('Melk (Halfvolle melk 1 l)')).toBe('Halfvolle melk 1 l');
    expect(projectionSearchTerm('Basil')).toBe('Basil');
    expect(projectionSearchTerm('Kaas (jong) (Jong belegen)')).toBe('Jong belegen');
  });

  it('opens the queue view that can list the row, and offers nothing for a row without an ingredient', () => {
    expect(PROJECTION_FIX.no_retailer_mapping).toMatchObject({ target: 'products', tab: 'todo' });
    expect(PROJECTION_FIX.mapping_unconfirmed.tab).toBe('attention');
    expect(PROJECTION_FIX.mapping_unit_changed.tab).toBe('attention');
    expect(PROJECTION_FIX.missing_unit.tab).toBe('mapped');
    expect(PROJECTION_FIX.no_food.target).toBe('none');
    expect(PROJECTION_FIX.no_conversion.target).toBe('conversions');
  });
});

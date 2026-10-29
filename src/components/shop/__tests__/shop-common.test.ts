import { describe, expect, it } from 'vitest';
import { attentionCount, receiptCheckWindow } from '../shop-common';
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

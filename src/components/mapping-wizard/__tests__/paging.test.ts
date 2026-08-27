import { describe, expect, it } from 'vitest';
import {
  buildPageWindow,
  clampPageOffset,
  describePageRange,
  DEFAULT_PAGE_SIZE,
} from '../paging';

const items = (count: number) => Array.from({ length: count }, (_, index) => index);

describe('clampPageOffset', () => {
  it('returns 0 for non-positive or non-finite offsets', () => {
    expect(clampPageOffset(0, 100, 50)).toBe(0);
    expect(clampPageOffset(-50, 100, 50)).toBe(0);
    expect(clampPageOffset(Number.NaN, 100, 50)).toBe(0);
  });

  it('snaps an arbitrary offset down to a page boundary', () => {
    expect(clampPageOffset(73, 500, 50)).toBe(50);
  });

  it('clamps past-the-end offsets to the last page rather than an empty view', () => {
    // 120 items, page size 50 -> last page starts at 100.
    expect(clampPageOffset(400, 120, 50)).toBe(100);
  });

  it('keeps the last page stable when total is an exact multiple of the page size', () => {
    expect(clampPageOffset(1000, 100, 50)).toBe(50);
  });

  it('returns 0 when the list is empty', () => {
    expect(clampPageOffset(200, 0, 50)).toBe(0);
  });
});

describe('buildPageWindow', () => {
  it('slices the requested page', () => {
    const window = buildPageWindow(items(500), 100, 50);

    expect(window.rows).toHaveLength(50);
    expect(window.rows[0]).toBe(100);
    expect(window.offset).toBe(100);
    expect(window.page).toBe(3);
    expect(window.pageCount).toBe(10);
    expect(window.hasPrevious).toBe(true);
    expect(window.hasNext).toBe(true);
  });

  it('caps the number of rendered rows — the point of the whole module', () => {
    const window = buildPageWindow(items(5000), 0, DEFAULT_PAGE_SIZE);

    expect(window.rows).toHaveLength(DEFAULT_PAGE_SIZE);
    expect(window.total).toBe(5000);
  });

  it('reports a short final page', () => {
    const window = buildPageWindow(items(120), 100, 50);

    expect(window.rows).toHaveLength(20);
    expect(window.hasNext).toBe(false);
    expect(window.hasPrevious).toBe(true);
  });

  it('recovers when the list shrank under a user sitting on a later page', () => {
    const window = buildPageWindow(items(30), 200, 50);

    expect(window.offset).toBe(0);
    expect(window.rows).toHaveLength(30);
    expect(window.page).toBe(1);
  });

  it('handles an empty list without producing page 0', () => {
    const window = buildPageWindow(items(0), 0, 50);

    expect(window.rows).toEqual([]);
    expect(window.page).toBe(1);
    expect(window.pageCount).toBe(1);
    expect(window.hasPrevious).toBe(false);
    expect(window.hasNext).toBe(false);
  });

  it('falls back to the default page size when given a non-positive one', () => {
    expect(buildPageWindow(items(200), 0, 0).pageSize).toBe(DEFAULT_PAGE_SIZE);
  });
});

describe('describePageRange', () => {
  it('describes a full page', () => {
    expect(describePageRange(buildPageWindow(items(4812), 50, 50))).toBe('51-100 of 4812');
  });

  it('describes a short final page', () => {
    expect(describePageRange(buildPageWindow(items(120), 100, 50))).toBe('101-120 of 120');
  });

  it('describes an empty list', () => {
    expect(describePageRange(buildPageWindow(items(0), 0, 50))).toBe('0 of 0');
  });
});

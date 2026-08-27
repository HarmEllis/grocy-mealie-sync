/**
 * Client-side paging helpers for the Mapping Wizard tabs.
 *
 * These exist so a tab renders a bounded window of rows instead of the whole
 * result set. With ~5000 unmapped foods the previous full-list render mounted
 * 5000 table rows and two `Combobox.Root` instances per row, which exhausted
 * browser memory (issue #46).
 *
 * Kept as a plain module (no JSX, no hooks) so it is unit-testable — this repo
 * has no jsdom/testing-library harness, so component-level logic that needs
 * coverage has to live outside the component.
 */

export const DEFAULT_PAGE_SIZE = 50;
export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export interface PageWindow<T> {
  /** The rows to render. */
  rows: T[];
  /** Offset actually used, after clamping to a valid page boundary. */
  offset: number;
  pageSize: number;
  total: number;
  /** 1-based page number, 1 when there are no rows at all. */
  page: number;
  pageCount: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

/**
 * Snap `offset` to a page boundary inside `[0, lastPageOffset]`.
 *
 * Filtering can shrink the list under a user who is on a later page, so an
 * out-of-range offset must resolve to the last page rather than an empty view.
 */
export function clampPageOffset(offset: number, total: number, pageSize: number): number {
  if (!Number.isFinite(offset) || offset <= 0 || total <= 0 || pageSize <= 0) {
    return 0;
  }

  const lastPageOffset = Math.max(0, Math.floor((total - 1) / pageSize) * pageSize);
  const snapped = Math.floor(offset / pageSize) * pageSize;

  return Math.min(snapped, lastPageOffset);
}

/** Slice `items` into the page containing `offset`, clamping first. */
export function buildPageWindow<T>(
  items: readonly T[],
  offset: number,
  pageSize: number,
): PageWindow<T> {
  const total = items.length;
  const safePageSize = pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE;
  const safeOffset = clampPageOffset(offset, total, safePageSize);
  const rows = items.slice(safeOffset, safeOffset + safePageSize);

  return {
    rows,
    offset: safeOffset,
    pageSize: safePageSize,
    total,
    page: total === 0 ? 1 : Math.floor(safeOffset / safePageSize) + 1,
    pageCount: Math.max(1, Math.ceil(total / safePageSize)),
    hasPrevious: safeOffset > 0,
    hasNext: safeOffset + rows.length < total,
  };
}

/** "51-100 of 4812", or "0 of 0" when empty. Shown next to the pager. */
export function describePageRange(window: Pick<PageWindow<unknown>, 'offset' | 'rows' | 'total'>): string {
  if (window.total === 0 || window.rows.length === 0) {
    return `0 of ${window.total}`;
  }

  const first = window.offset + 1;
  const last = window.offset + window.rows.length;

  return `${first}-${last} of ${window.total}`;
}

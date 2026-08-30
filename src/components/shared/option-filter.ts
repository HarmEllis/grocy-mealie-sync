/**
 * Query filtering for {@link SearchableSelect}.
 *
 * The component filters its own options instead of handing the full list to
 * base-ui, so a closed combobox never holds more than its own selection. With
 * ~5000 options and ~50 rows on screen that is the difference between ~100
 * live 5000-element arrays and ~100 single-element ones (issue #46).
 */

export interface FilterableOption<T extends string | number> {
  value: T;
  label: string;
}

export interface FilterOptionsParams<T extends string | number> {
  options: ReadonlyArray<FilterableOption<T>>;
  query: string;
  limit: number;
  /**
   * Hides values claimed by another row. Never applied to `pinned` — a row
   * must keep seeing its own selection.
   */
  isValueExcluded?: ((value: T) => boolean) | null;
  /** The row's own selection, listed first when it matches the query. */
  pinned?: FilterableOption<T> | null;
}

/**
 * Returns at most `limit` options whose label contains `query`, pinned option
 * first. Scans no further than it has to: once `limit` matches are collected
 * the remaining options are never touched.
 */
export function filterOptions<T extends string | number>({
  options,
  query,
  limit,
  isValueExcluded = null,
  pinned = null,
}: FilterOptionsParams<T>): Array<FilterableOption<T>> {
  const needle = query.trim().toLowerCase();
  const matches = (label: string) => needle === '' || label.toLowerCase().includes(needle);

  const result: Array<FilterableOption<T>> = [];

  if (pinned && matches(pinned.label)) {
    result.push(pinned);
  }

  if (limit >= 0 && result.length >= limit) {
    return result;
  }

  for (const option of options) {
    if (pinned && option.value === pinned.value) {
      continue;
    }
    if (isValueExcluded?.(option.value)) {
      continue;
    }
    if (!matches(option.label)) {
      continue;
    }

    result.push(option);

    if (limit >= 0 && result.length >= limit) {
      break;
    }
  }

  return result;
}

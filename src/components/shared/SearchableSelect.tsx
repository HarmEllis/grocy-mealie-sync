'use client';

import { useMemo, useState } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { filterOptions } from './option-filter';

interface Option<T extends string | number> {
  value: T;
  label: string;
}

const NO_OPTIONS: ReadonlyArray<never> = [];

/*
 * These four callbacks are module-level on purpose.
 *
 * base-ui memoises its filtering on the identity of `filter` and
 * `itemToStringLabel`, and re-runs its `syncSelectedIndex` layout effect
 * whenever `isItemEqualToValue` changes. That effect does a linear
 * `findIndex` over the whole `items` array. Passing inline arrows made all
 * of that re-run on every render: with ~50 rows x 2 comboboxes x ~5000
 * options that was ~500k comparisons, synchronously, before every paint —
 * the ~2s lag on ticking a checkbox (issue #46).
 */
function optionToLabel(option: Option<string | number> | null | undefined): string {
  return option ? option.label : '';
}

function optionToValue(option: Option<string | number> | null | undefined): string {
  return option ? String(option.value) : '';
}

function optionsEqual(
  option: Option<string | number>,
  selected: Option<string | number>,
): boolean {
  return option.value === selected.value;
}

interface SearchableSelectProps<T extends string | number> {
  options: ReadonlyArray<Option<T>>;
  value: T | null;
  onChange: (value: T | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  ariaLabel?: string;
  className?: string;
  controlClassName?: string;
  clearable?: boolean;
  disabled?: boolean;
  /**
   * An option to merge into `options` when it is not already there.
   *
   * Callers that enforce a one-to-one mapping pass one shared `options` array
   * plus this row's own selection, so no row allocates a filtered copy of the
   * full list.
   */
  extraOption?: Option<T> | null;
  /**
   * Hides values claimed by another row. A callback rather than a set so that
   * it can keep a stable identity while the underlying selection changes —
   * a set would be a new object on every pick, which defeats `React.memo` on
   * the rows and re-renders every combobox on the page. It is only consulted
   * while the popup is open, and a popup closes as soon as something is
   * picked, so it never reads a stale answer.
   */
  isValueExcluded?: ((value: T) => boolean) | null;
  /** Hard cap on rendered items. Guards against an unbounded popup. */
  limit?: number;
}

export function SearchableSelect<T extends string | number>({
  options,
  value,
  onChange,
  placeholder = 'Search...',
  searchPlaceholder,
  ariaLabel,
  className,
  controlClassName,
  clearable = true,
  disabled = false,
  extraOption = null,
  isValueExcluded = null,
  limit = 200,
}: SearchableSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Depend on the primitives rather than the object so an inline `extraOption`
  // literal does not invalidate these memos on every parent render.
  const extraValue = extraOption?.value ?? null;
  const extraLabel = extraOption?.label ?? null;

  // The caller-supplied selection, which `options` may not contain (it is
  // hidden from the shared array by `isValueExcluded`). Listing it
  // first is the only way to show it at all; options that are still in the
  // array keep their natural position.
  const pinnedOption = useMemo<Option<T> | null>(() => (
    extraValue !== null && extraLabel !== null && extraValue === value
      ? { value: extraValue, label: extraLabel }
      : null
  ), [extraValue, extraLabel, value]);

  // Resolve the selection without touching `options` when the caller already
  // supplied its label, so a row whose selection is hidden by `isValueExcluded`
  // still renders its name.
  const selectedOption = useMemo<Option<T> | null>(() => {
    if (value === null) {
      return null;
    }
    return pinnedOption ?? options.find(option => option.value === value) ?? null;
  }, [options, value, pinnedOption]);

  // A closed combobox holds nothing but its own selection. base-ui walks
  // `items` in a layout effect, so handing every closed row the full list is
  // what made the page crawl.
  //
  // Kept in two memos rather than one branch: the closed list must not depend
  // on `query` or the exclusion callback. Those change whenever a row is edited,
  // and a fresh array identity is enough to make base-ui redo its work in
  // every one of the ~100 comboboxes on the page.
  const closedOptions = useMemo<ReadonlyArray<Option<T>>>(
    () => (selectedOption ? [selectedOption] : NO_OPTIONS),
    [selectedOption],
  );

  const openOptions = useMemo<ReadonlyArray<Option<T>>>(
    () => (open ? filterOptions({ options, query, limit, isValueExcluded, pinned: pinnedOption }) : NO_OPTIONS),
    [open, options, query, limit, isValueExcluded, pinnedOption],
  );

  const listOptions = open ? openOptions : closedOptions;

  const inputValue = open ? query : (selectedOption?.label ?? '');

  function clearSelection(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (disabled) {
      return;
    }

    onChange(null);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className={cn('relative min-w-0', className)}>
      <Combobox.Root<Option<T>>
        items={listOptions}
        value={selectedOption}
        onValueChange={next => {
          onChange(next ? next.value : null);
          setQuery('');
          setOpen(false);
        }}
        itemToStringLabel={optionToLabel}
        itemToStringValue={optionToValue}
        isItemEqualToValue={optionsEqual}
        open={open}
        onOpenChange={nextOpen => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setQuery('');
          }
        }}
        inputValue={inputValue}
        onInputValueChange={nextValue => setQuery(nextValue)}
        openOnInputClick
        autoHighlight
        highlightItemOnHover
        loopFocus
        disabled={disabled}
        /* `listOptions` is already filtered and capped; re-filtering here
           would only undo that work. */
        filter={null}
      >
        <div
          className={cn(
            'flex h-8 min-w-0 w-full items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm transition-colors',
            'border-input bg-background hover:bg-muted/50',
            selectedOption !== null && !open && 'bg-success/10 border-success/30',
            disabled && 'cursor-not-allowed opacity-60 hover:bg-background',
            controlClassName,
          )}
        >
          <Combobox.Input
            aria-label={ariaLabel}
            placeholder={open ? (searchPlaceholder ?? placeholder) : (selectedOption ? undefined : placeholder)}
            className={cn(
              'w-full border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground',
              disabled && 'cursor-not-allowed',
            )}
            onFocus={() => {
              if (!disabled) {
                setOpen(true);
                setQuery('');
              }
            }}
          />

          {clearable && value !== null && !disabled ? (
            <button
              type="button"
              onClick={clearSelection}
              aria-label="Clear selection"
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        <Combobox.Portal>
          <Combobox.Positioner sideOffset={4} className="z-[60]">
            <Combobox.Popup className="overflow-auto rounded-md border border-input bg-popover shadow-md max-h-[200px] min-w-[var(--anchor-width)]">
              <Combobox.Empty className="px-2 py-1.5 text-sm text-muted-foreground">
                No results
              </Combobox.Empty>

              <Combobox.List>
                {(item, index) => (
                  <Combobox.Item
                    key={String(item.value)}
                    index={index}
                    value={item}
                    className={cn(
                      'cursor-pointer px-2 py-1.5 text-sm transition-colors outline-none',
                      'data-[highlighted]:bg-accent data-[selected]:bg-success/10',
                    )}
                  >
                    {item.label}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Option<T extends string | number> {
  value: T;
  label: string;
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
}: SearchableSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedOption = useMemo(() => (
    value === null ? null : options.find(option => option.value === value) ?? null
  ), [options, value]);

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
        items={options}
        value={selectedOption}
        onValueChange={next => {
          onChange(next ? next.value : null);
          setQuery('');
          setOpen(false);
        }}
        itemToStringLabel={item => item.label}
        itemToStringValue={item => String(item.value)}
        isItemEqualToValue={(item, selected) => item.value === selected.value}
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
        filter={(item, rawQuery) => item.label.toLowerCase().includes(rawQuery.trim().toLowerCase())}
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

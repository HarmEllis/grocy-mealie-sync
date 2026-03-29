'use client';

import { useState, useRef, useEffect, useMemo, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface Option<T extends string | number> {
  value: T;
  label: string;
}

interface SearchableSelectProps<T extends string | number> {
  options: Option<T>[];
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

interface DropdownPosition {
  left: number;
  width: number;
  maxHeight: number;
  placement: 'top' | 'bottom';
  top?: number;
  bottom?: number;
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
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selectedLabel = value !== null ? options.find(o => o.value === value)?.label ?? '' : '';

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, search]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [filtered]);

  const updateDropdownPosition = useCallback(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    const rect = containerRef.current.getBoundingClientRect();
    const viewportPadding = 8;
    const dropdownGap = 4;
    const preferredHeight = 200;
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding - dropdownGap;
    const availableAbove = rect.top - viewportPadding - dropdownGap;
    const placement = availableBelow < preferredHeight && availableAbove > availableBelow ? 'top' : 'bottom';
    const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(rect.left, viewportPadding),
      window.innerWidth - width - viewportPadding,
    );

    setDropdownPosition({
      left,
      width,
      maxHeight: Math.max(0, Math.min(preferredHeight, placement === 'top' ? availableAbove : availableBelow)),
      placement,
      top: placement === 'bottom' ? rect.bottom + dropdownGap : undefined,
      bottom: placement === 'top' ? window.innerHeight - rect.top + dropdownGap : undefined,
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || listboxRef.current?.contains(target)) return;
      setOpen(false);
      setSearch('');
      setActiveIndex(-1);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) {
      setDropdownPosition(null);
      return;
    }

    updateDropdownPosition();

    function handleReposition() {
      updateDropdownPosition();
    }

    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, updateDropdownPosition]);

  useEffect(() => {
    if (activeIndex >= 0 && listboxRef.current) {
      const activeEl = listboxRef.current.querySelector(`[data-index="${activeIndex}"]`);
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleSelect = useCallback((val: T) => {
    onChange(val);
    setOpen(false);
    setSearch('');
    setActiveIndex(-1);
  }, [onChange]);

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    if (disabled) {
      return;
    }
    onChange(null);
    setSearch('');
    setActiveIndex(-1);
  }

  function openDropdown() {
    if (disabled) {
      return;
    }
    setOpen(true);
    setTimeout(() => {
      updateDropdownPosition();
      inputRef.current?.focus();
    }, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) {
      return;
    }

    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filtered.length) {
          handleSelect(filtered[activeIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setSearch('');
        setActiveIndex(-1);
        break;
    }
  }

  const activeDescendant = activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;
  const dropdown = open && dropdownPosition && typeof document !== 'undefined' ? createPortal(
    <div
      ref={listboxRef}
      id={listboxId}
      role="listbox"
      className="fixed z-[60] overflow-auto rounded-md border border-input bg-popover shadow-md"
      style={{
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        maxHeight: dropdownPosition.maxHeight,
        top: dropdownPosition.top,
        bottom: dropdownPosition.bottom,
      }}
    >
      {filtered.length === 0 ? (
        <div className="px-2 py-1.5 text-sm text-muted-foreground">
          No results
        </div>
      ) : (
        filtered.map((opt, index) => (
          <div
            key={String(opt.value)}
            id={`${listboxId}-option-${index}`}
            role="option"
            data-index={index}
            aria-selected={opt.value === value}
            onClick={() => handleSelect(opt.value)}
            onMouseEnter={() => setActiveIndex(index)}
            className={cn(
              'px-2 py-1.5 text-sm cursor-pointer transition-colors',
              index === activeIndex && 'bg-accent',
              opt.value === value && index !== activeIndex && 'bg-success/10',
            )}
          >
            {opt.label}
          </div>
        ))
      )}
    </div>,
    document.body,
  ) : null;

  return (
    <div ref={containerRef} className={cn('relative min-w-0', className)}>
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-owns={listboxId}
        aria-activedescendant={activeDescendant}
        aria-disabled={disabled}
        aria-label={ariaLabel}
        tabIndex={disabled ? -1 : open ? -1 : 0}
        onClick={disabled ? undefined : openDropdown}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex h-8 min-w-0 w-full items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm cursor-pointer',
          'border-input bg-background hover:bg-muted/50 transition-colors',
          value !== null && 'bg-success/10 border-success/30',
          disabled && 'cursor-not-allowed opacity-60 hover:bg-background',
          controlClassName,
        )}
      >
        {open ? (
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label={ariaLabel}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-activedescendant={activeDescendant}
            placeholder={value !== null ? selectedLabel : (searchPlaceholder ?? placeholder)}
            className="border-none outline-none text-sm w-full bg-transparent placeholder:text-muted-foreground"
          />
        ) : (
          <span className={cn(
            'flex-1 overflow-hidden text-ellipsis whitespace-nowrap',
            value !== null ? 'text-foreground' : 'text-muted-foreground',
          )}>
            {value !== null ? selectedLabel : placeholder}
          </span>
        )}
        {clearable && value !== null && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear selection"
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {dropdown}
    </div>
  );
}

'use client';

import { useState, useRef, useEffect, useMemo, useCallback, useId } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface Option {
  value: number;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  className?: string;
}

export function SearchableSelect({ options, value, onChange, placeholder = 'Search...', className }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeIndex >= 0 && listboxRef.current) {
      const activeEl = listboxRef.current.querySelector(`[data-index="${activeIndex}"]`);
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleSelect = useCallback((val: number) => {
    onChange(val);
    setOpen(false);
    setSearch('');
    setActiveIndex(-1);
  }, [onChange]);

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
    setSearch('');
    setActiveIndex(-1);
  }

  function openDropdown() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
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

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-owns={listboxId}
        aria-activedescendant={activeDescendant}
        tabIndex={open ? -1 : 0}
        onClick={openDropdown}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex items-center gap-1 rounded-md border px-2 py-1.5 text-sm cursor-pointer min-h-[30px]',
          'border-input bg-background hover:bg-muted/50 transition-colors',
          value !== null && 'bg-success/10 border-success/30',
        )}
      >
        {open ? (
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-activedescendant={activeDescendant}
            placeholder={value !== null ? selectedLabel : placeholder}
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
        {value !== null && (
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

      {open && (
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          className="absolute top-full left-0 right-0 z-50 max-h-[200px] overflow-auto rounded-b-md border border-t-0 border-input bg-popover shadow-md"
        >
          {filtered.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              No results
            </div>
          ) : (
            filtered.map((opt, index) => (
              <div
                key={opt.value}
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
        </div>
      )}
    </div>
  );
}

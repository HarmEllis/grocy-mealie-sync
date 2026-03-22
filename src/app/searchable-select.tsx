'use client';

import { useState, useRef, useEffect, useMemo, useCallback, useId } from 'react';

interface Option {
  value: number;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

export default function SearchableSelect({ options, value, onChange, placeholder = 'Search...', style }: SearchableSelectProps) {
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

  // Reset active index when filtered list changes
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

  // Scroll active option into view
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
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-owns={listboxId}
        aria-activedescendant={activeDescendant}
        tabIndex={open ? -1 : 0}
        onClick={openDropdown}
        onKeyDown={handleKeyDown}
        style={{
          padding: '0.3rem 0.4rem',
          fontSize: '0.85rem',
          border: '1px solid #ccc',
          borderRadius: 4,
          background: value !== null ? '#f0fdf4' : '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          minHeight: 30,
          gap: '0.25rem',
        }}
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
            style={{
              border: 'none',
              outline: 'none',
              fontSize: '0.85rem',
              width: '100%',
              background: 'transparent',
            }}
          />
        ) : (
          <span style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: value !== null ? '#333' : '#999',
          }}>
            {value !== null ? selectedLabel : placeholder}
          </span>
        )}
        {value !== null && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear selection"
            style={{
              cursor: 'pointer',
              color: '#999',
              fontSize: '0.9rem',
              padding: '0 2px',
              flexShrink: 0,
              background: 'none',
              border: 'none',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        )}
      </div>

      {open && (
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: 200,
            overflow: 'auto',
            background: '#fff',
            border: '1px solid #ccc',
            borderTop: 'none',
            borderRadius: '0 0 4px 4px',
            zIndex: 100,
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '0.4rem 0.5rem', color: '#999', fontSize: '0.85rem' }}>
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
                style={{
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  background: index === activeIndex ? '#e0f2fe' : opt.value === value ? '#f0fdf4' : undefined,
                }}
                onMouseEnter={() => setActiveIndex(index)}
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

'use client';

import { useState, useRef, useEffect } from 'react';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = value !== null ? options.find(o => o.value === value)?.label ?? '' : '';

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(val: number) {
    onChange(val);
    setOpen(false);
    setSearch('');
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
    setSearch('');
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <div
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
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
            onKeyDown={e => {
              if (e.key === 'Escape') { setOpen(false); setSearch(''); }
            }}
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
          <span
            onClick={handleClear}
            style={{ cursor: 'pointer', color: '#999', fontSize: '0.9rem', padding: '0 2px', flexShrink: 0 }}
            title="Clear"
          >
            &times;
          </span>
        )}
      </div>

      {open && (
        <div style={{
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
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '0.4rem 0.5rem', color: '#999', fontSize: '0.85rem' }}>
              No results
            </div>
          ) : (
            filtered.map(opt => (
              <div
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                style={{
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  background: opt.value === value ? '#e0f2fe' : undefined,
                }}
                onMouseEnter={e => { if (opt.value !== value) (e.target as HTMLDivElement).style.background = '#f3f4f6'; }}
                onMouseLeave={e => { (e.target as HTMLDivElement).style.background = opt.value === value ? '#e0f2fe' : ''; }}
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

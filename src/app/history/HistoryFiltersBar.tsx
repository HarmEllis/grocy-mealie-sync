'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { Input } from '@/components/ui/input';
import { type HistoryRunAction, type HistoryRunStatus, type HistoryRunTrigger } from '@/lib/history-types';
import { buildHistoryFilterSearchParams, dateRangePresets, resolveDateRangePreset, type DateRangePreset } from './history-filters';

interface HistoryFiltersBarProps {
  kind: 'mutation' | 'issue' | null;
  search: string;
  action: HistoryRunAction | null;
  trigger: HistoryRunTrigger | null;
  status: HistoryRunStatus | null;
  dateFrom: string | null;
  dateTo: string | null;
}

const historyTriggerOptions: Array<{ value: HistoryRunTrigger; label: string }> = [
  { value: 'manual', label: 'Manual' },
  { value: 'scheduler', label: 'Automatic' },
  { value: 'scanner', label: 'Scanner' },
];
const historyKindOptions: Array<{ value: 'mutation' | 'issue'; label: string }> = [
  { value: 'mutation', label: 'Changes' }, { value: 'issue', label: 'Errors & warnings' },
];
const HISTORY_SEARCH_DEBOUNCE_MS = 500;

export function HistoryFiltersBar({ search, action, trigger, status, dateFrom, dateTo, kind }: HistoryFiltersBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(search);
  const [triggerValue, setTriggerValue] = useState<HistoryRunTrigger | null>(trigger);
  const [kindValue, setKindValue] = useState<'mutation' | 'issue' | null>(kind);
  const [dateFromValue, setDateFromValue] = useState<string | null>(dateFrom);
  const [dateToValue, setDateToValue] = useState<string | null>(dateTo);
  const [datePreset, setDatePreset] = useState<DateRangePreset | null>(null);
  const [showDates, setShowDates] = useState(Boolean(dateFrom || dateTo));
  const lastSubmittedSearchRef = useRef(search);

  useEffect(() => {
    if (search === lastSubmittedSearchRef.current) {
      return;
    }

    lastSubmittedSearchRef.current = search;
    setSearchValue(search);
  }, [search]);

  useEffect(() => { setTriggerValue(trigger); }, [trigger]);
  useEffect(() => { setKindValue(kind); }, [kind]);
  useEffect(() => { setDateFromValue(dateFrom); }, [dateFrom]);
  useEffect(() => { setDateToValue(dateTo); }, [dateTo]);

  function replaceFilters(nextValues: {
    search: string;
    action: HistoryRunAction | null;
    trigger: HistoryRunTrigger | null;
    status: HistoryRunStatus | null;
    kind: 'mutation' | 'issue' | null;
    dateFrom: string | null;
    dateTo: string | null;
  }) {
    const normalizedSearch = nextValues.search.trim();
    lastSubmittedSearchRef.current = normalizedSearch;

    const nextQuery = buildHistoryFilterSearchParams(new URLSearchParams(searchParams.toString()), {
      search: normalizedSearch,
      action: nextValues.action,
      trigger: nextValues.trigger,
      status: nextValues.status,
      kind: nextValues.kind,
      dateFrom: nextValues.dateFrom,
      dateTo: nextValues.dateTo,
    });

    startTransition(() => {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    });
  }

  function currentFilterValues() {
    return {
      search: searchValue,
      action,
      trigger: triggerValue,
      status,
      kind: kindValue,
      dateFrom: dateFromValue,
      dateTo: dateToValue,
    };
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (searchValue.trim() === search) {
        return;
      }

      replaceFilters(currentFilterValues());
    }, HISTORY_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [action, search, searchValue, triggerValue, status, kindValue, dateFromValue, dateToValue]);

  return (
    <div className="mb-4 grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-center">
      <SearchableSelect
        options={historyTriggerOptions}
        value={triggerValue}
        onChange={(nextTrigger) => {
          setTriggerValue(nextTrigger);
          replaceFilters({ ...currentFilterValues(), trigger: nextTrigger });
        }}
        ariaLabel="Filter by trigger"
        placeholder="All sources"
        searchPlaceholder="Search sources..."
        className="w-full lg:w-[150px]"
        controlClassName="h-10 lg:h-8"
      />

      <SearchableSelect
        options={historyKindOptions}
        value={kindValue}
        onChange={(nextKind) => {
          setKindValue(nextKind);
          replaceFilters({ ...currentFilterValues(), kind: nextKind });
        }}
        ariaLabel="Filter by activity"
        placeholder="Changes & issues"
        searchPlaceholder="Search activity types..."
        className="w-full lg:w-[180px]"
        controlClassName="h-10 lg:h-8"
      />

      <button type="button" aria-expanded={showDates} onClick={() => setShowDates(!showDates)} className="col-span-2 min-h-9 text-left text-xs text-text-2 lg:hidden">
        Date filters {dateFromValue || dateToValue ? '(active)' : ''} {showDates ? '▴' : '▾'}
      </button>

      <div className={showDates ? 'contents' : 'hidden lg:contents'}>
        <SearchableSelect
          options={dateRangePresets}
          value={datePreset}
          onChange={(preset) => {
            setDatePreset(preset);
            if (preset) {
              const { from, to } = resolveDateRangePreset(preset);
              setDateFromValue(from);
              setDateToValue(to);
              replaceFilters({ ...currentFilterValues(), dateFrom: from, dateTo: to });
            } else {
              setDateFromValue(null);
              setDateToValue(null);
              replaceFilters({ ...currentFilterValues(), dateFrom: null, dateTo: null });
            }
          }}
          ariaLabel="Date range"
          placeholder="All dates"
          searchPlaceholder="Search presets..."
          className="col-span-2 w-full lg:w-[150px]"
          controlClassName="h-10 lg:h-8"
        />

        <Input
          type="date"
          value={dateFromValue ?? ''}
          onChange={(event) => {
            const val = event.target.value || null;
            setDateFromValue(val);
            setDatePreset(null);
            replaceFilters({ ...currentFilterValues(), dateFrom: val });
          }}
          aria-label="Date from"
          className="h-10 w-full lg:h-8 lg:w-[140px]"
        />
        <Input
          type="date"
          value={dateToValue ?? ''}
          onChange={(event) => {
            const val = event.target.value || null;
            setDateToValue(val);
            setDatePreset(null);
            replaceFilters({ ...currentFilterValues(), dateTo: val });
          }}
          aria-label="Date to"
          className="h-10 w-full lg:h-8 lg:w-[140px]"
        />

      </div>

      <Input
        placeholder="Search products or changes..."
        value={searchValue}
        onChange={(event) => setSearchValue(event.target.value)}
        aria-label="Search history"
        className="order-first col-span-2 h-10 w-full lg:order-none lg:h-8 lg:max-w-[280px]"
      />
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { Input } from '@/components/ui/input';
import { formatHistoryStatusLabel } from '@/lib/history-events';
import { historyRunStatuses, type HistoryRunAction, type HistoryRunStatus, type HistoryRunTrigger } from '@/lib/history-types';
import { buildHistoryFilterSearchParams, dateRangePresets, getHistoryActionFilterOptions, resolveDateRangePreset, type DateRangePreset } from './history-filters';

interface HistoryFiltersBarProps {
  search: string;
  action: HistoryRunAction | null;
  trigger: HistoryRunTrigger | null;
  status: HistoryRunStatus | null;
  dateFrom: string | null;
  dateTo: string | null;
}

const historyActionOptions = getHistoryActionFilterOptions();
const historyTriggerOptions: Array<{ value: HistoryRunTrigger; label: string }> = [
  { value: 'manual', label: 'Manual' },
  { value: 'scheduler', label: 'Scheduler' },
];
const historyStatusOptions: Array<{ value: HistoryRunStatus; label: string }> =
  historyRunStatuses.map(s => ({ value: s, label: formatHistoryStatusLabel(s) }));
const HISTORY_SEARCH_DEBOUNCE_MS = 500;

export function HistoryFiltersBar({ search, action, trigger, status, dateFrom, dateTo }: HistoryFiltersBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(search);
  const [actionValue, setActionValue] = useState<HistoryRunAction | null>(action);
  const [triggerValue, setTriggerValue] = useState<HistoryRunTrigger | null>(trigger);
  const [statusValue, setStatusValue] = useState<HistoryRunStatus | null>(status);
  const [dateFromValue, setDateFromValue] = useState<string | null>(dateFrom);
  const [dateToValue, setDateToValue] = useState<string | null>(dateTo);
  const [datePreset, setDatePreset] = useState<DateRangePreset | null>(null);
  const lastSubmittedSearchRef = useRef(search);

  useEffect(() => {
    if (search === lastSubmittedSearchRef.current) {
      return;
    }

    lastSubmittedSearchRef.current = search;
    setSearchValue(search);
  }, [search]);

  useEffect(() => { setActionValue(action); }, [action]);
  useEffect(() => { setTriggerValue(trigger); }, [trigger]);
  useEffect(() => { setStatusValue(status); }, [status]);
  useEffect(() => { setDateFromValue(dateFrom); }, [dateFrom]);
  useEffect(() => { setDateToValue(dateTo); }, [dateTo]);

  function replaceFilters(nextValues: {
    search: string;
    action: HistoryRunAction | null;
    trigger: HistoryRunTrigger | null;
    status: HistoryRunStatus | null;
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
      action: actionValue,
      trigger: triggerValue,
      status: statusValue,
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
  }, [actionValue, search, searchValue, triggerValue, statusValue, dateFromValue, dateToValue]);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <SearchableSelect
        options={historyActionOptions}
        value={actionValue}
        onChange={(nextAction) => {
          setActionValue(nextAction);
          replaceFilters({ ...currentFilterValues(), action: nextAction });
        }}
        ariaLabel="Filter by action"
        placeholder="All actions"
        searchPlaceholder="Search actions..."
        className="w-[220px]"
      />

      <SearchableSelect
        options={historyTriggerOptions}
        value={triggerValue}
        onChange={(nextTrigger) => {
          setTriggerValue(nextTrigger);
          replaceFilters({ ...currentFilterValues(), trigger: nextTrigger });
        }}
        ariaLabel="Filter by trigger"
        placeholder="All triggers"
        searchPlaceholder="Search triggers..."
        className="w-[120px]"
      />

      <SearchableSelect
        options={historyStatusOptions}
        value={statusValue}
        onChange={(nextStatus) => {
          setStatusValue(nextStatus);
          replaceFilters({ ...currentFilterValues(), status: nextStatus });
        }}
        ariaLabel="Filter by status"
        placeholder="All statuses"
        searchPlaceholder="Search statuses..."
        className="w-[140px]"
      />

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
        className="w-[150px]"
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
        className="w-[140px]"
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
        className="w-[140px]"
      />

      <Input
        placeholder="Filter history..."
        value={searchValue}
        onChange={(event) => setSearchValue(event.target.value)}
        aria-label="Search history"
        className="max-w-[280px]"
      />
    </div>
  );
}

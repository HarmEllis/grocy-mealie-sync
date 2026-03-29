'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { Input } from '@/components/ui/input';
import { type HistoryRunAction, type HistoryRunTrigger } from '@/lib/history-types';
import { buildHistoryFilterSearchParams, getHistoryActionFilterOptions } from './history-filters';

interface HistoryFiltersBarProps {
  search: string;
  action: HistoryRunAction | null;
  trigger: HistoryRunTrigger | null;
}

const historyActionOptions = getHistoryActionFilterOptions();
const historyTriggerOptions: Array<{ value: HistoryRunTrigger; label: string }> = [
  { value: 'manual', label: 'Manual' },
  { value: 'scheduler', label: 'Scheduler' },
];
const HISTORY_SEARCH_DEBOUNCE_MS = 500;

export function HistoryFiltersBar({ search, action, trigger }: HistoryFiltersBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(search);
  const [actionValue, setActionValue] = useState<HistoryRunAction | null>(action);
  const [triggerValue, setTriggerValue] = useState<HistoryRunTrigger | null>(trigger);
  const lastSubmittedSearchRef = useRef(search);

  useEffect(() => {
    if (search === lastSubmittedSearchRef.current) {
      return;
    }

    lastSubmittedSearchRef.current = search;
    setSearchValue(search);
  }, [search]);

  useEffect(() => {
    setActionValue(action);
  }, [action]);

  useEffect(() => {
    setTriggerValue(trigger);
  }, [trigger]);

  function replaceFilters(nextValues: {
    search: string;
    action: HistoryRunAction | null;
    trigger: HistoryRunTrigger | null;
  }) {
    const normalizedSearch = nextValues.search.trim();
    lastSubmittedSearchRef.current = normalizedSearch;

    const nextQuery = buildHistoryFilterSearchParams(new URLSearchParams(searchParams.toString()), {
      search: normalizedSearch,
      action: nextValues.action,
      trigger: nextValues.trigger,
    });

    startTransition(() => {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    });
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (searchValue.trim() === search) {
        return;
      }

      replaceFilters({
        search: searchValue,
        action: actionValue,
        trigger: triggerValue,
      });
    }, HISTORY_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [actionValue, search, searchValue, triggerValue]);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <SearchableSelect
        options={historyActionOptions}
        value={actionValue}
        onChange={(nextAction) => {
          setActionValue(nextAction);
          replaceFilters({
            search: searchValue,
            action: nextAction,
            trigger: triggerValue,
          });
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
          replaceFilters({
            search: searchValue,
            action: actionValue,
            trigger: nextTrigger,
          });
        }}
        ariaLabel="Filter by trigger"
        placeholder="All triggers"
        searchPlaceholder="Search triggers..."
        className="w-[120px]"
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

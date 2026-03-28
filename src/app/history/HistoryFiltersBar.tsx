'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { formatHistoryActionLabel } from '@/lib/history-events';
import { historyRunActions, type HistoryRunAction, type HistoryRunTrigger } from '@/lib/history-types';
import { buildHistoryFilterSearchParams } from './history-filters';

interface HistoryFiltersBarProps {
  search: string;
  action: HistoryRunAction | null;
  trigger: HistoryRunTrigger | null;
}

export function HistoryFiltersBar({ search, action, trigger }: HistoryFiltersBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(search);
  const [actionValue, setActionValue] = useState(action ?? '');
  const [triggerValue, setTriggerValue] = useState(trigger ?? '');

  useEffect(() => {
    setSearchValue(search);
  }, [search]);

  useEffect(() => {
    setActionValue(action ?? '');
  }, [action]);

  useEffect(() => {
    setTriggerValue(trigger ?? '');
  }, [trigger]);

  function replaceFilters(nextValues: {
    search: string;
    action: string;
    trigger: string;
  }) {
    const nextQuery = buildHistoryFilterSearchParams(new URLSearchParams(searchParams.toString()), {
      search: nextValues.search,
      action: nextValues.action || null,
      trigger: nextValues.trigger || null,
    });

    startTransition(() => {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    });
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (searchValue === search) {
        return;
      }

      replaceFilters({
        search: searchValue,
        action: actionValue,
        trigger: triggerValue,
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [actionValue, search, searchValue, triggerValue]);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <select
        value={actionValue}
        onChange={(event) => {
          const nextAction = event.target.value;
          setActionValue(nextAction);
          replaceFilters({
            search: searchValue,
            action: nextAction,
            trigger: triggerValue,
          });
        }}
        aria-label="Filter by action"
        className="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
      >
        <option value="">All actions</option>
        {historyRunActions.map(historyAction => (
          <option key={historyAction} value={historyAction}>
            {formatHistoryActionLabel(historyAction)}
          </option>
        ))}
      </select>

      <select
        value={triggerValue}
        onChange={(event) => {
          const nextTrigger = event.target.value;
          setTriggerValue(nextTrigger);
          replaceFilters({
            search: searchValue,
            action: actionValue,
            trigger: nextTrigger,
          });
        }}
        aria-label="Filter by trigger"
        className="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
      >
        <option value="">All triggers</option>
        <option value="manual">Manual</option>
        <option value="scheduler">Scheduler</option>
      </select>

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

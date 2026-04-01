import { formatHistoryActionLabel } from '@/lib/history-events';
import {
  historyRunActions,
  isHistoryRunAction,
  isHistoryRunStatus,
  isHistoryRunTrigger,
  type HistoryRunAction,
  type HistoryRunStatus,
  type HistoryRunTrigger,
} from '@/lib/history-types';

export type HistoryPageSearchParams = Record<string, string | string[] | undefined>;

export interface ResolvedHistoryFilters {
  search: string;
  action: HistoryRunAction | null;
  trigger: HistoryRunTrigger | null;
  status: HistoryRunStatus | null;
  dateFrom: string | null;
  dateTo: string | null;
  hasFilters: boolean;
}

export interface HistoryFilterFormValues {
  search: string;
  action: string | null;
  trigger: string | null;
  status: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

export interface HistoryActionFilterOption {
  value: HistoryRunAction;
  label: string;
}

function getSingleSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseValidDate(value: string | undefined | null): string | null {
  if (!value || !DATE_PATTERN.test(value)) {
    return null;
  }

  return value;
}

export function resolveHistoryFilters(searchParams: HistoryPageSearchParams | undefined): ResolvedHistoryFilters {
  const search = getSingleSearchParam(searchParams?.q)?.trim() ?? '';
  const actionParam = getSingleSearchParam(searchParams?.action);
  const triggerParam = getSingleSearchParam(searchParams?.trigger);
  const statusParam = getSingleSearchParam(searchParams?.status);
  const action = actionParam && isHistoryRunAction(actionParam) ? actionParam : null;
  const trigger = triggerParam && isHistoryRunTrigger(triggerParam) ? triggerParam : null;
  const status = statusParam && isHistoryRunStatus(statusParam) ? statusParam : null;
  const dateFrom = parseValidDate(getSingleSearchParam(searchParams?.dateFrom));
  const dateTo = parseValidDate(getSingleSearchParam(searchParams?.dateTo));

  return {
    search,
    action,
    trigger,
    status,
    dateFrom,
    dateTo,
    hasFilters: search.length > 0 || action !== null || trigger !== null || status !== null || dateFrom !== null || dateTo !== null,
  };
}

export function buildHistoryFilterSearchParams(
  searchParams: URLSearchParams,
  values: HistoryFilterFormValues,
): string {
  const nextSearchParams = new URLSearchParams(searchParams);
  const trimmedSearch = values.search.trim();

  if (trimmedSearch) {
    nextSearchParams.set('q', trimmedSearch);
  } else {
    nextSearchParams.delete('q');
  }

  if (values.action && isHistoryRunAction(values.action)) {
    nextSearchParams.set('action', values.action);
  } else {
    nextSearchParams.delete('action');
  }

  if (values.trigger && isHistoryRunTrigger(values.trigger)) {
    nextSearchParams.set('trigger', values.trigger);
  } else {
    nextSearchParams.delete('trigger');
  }

  if (values.status && isHistoryRunStatus(values.status)) {
    nextSearchParams.set('status', values.status);
  } else {
    nextSearchParams.delete('status');
  }

  if (values.dateFrom && DATE_PATTERN.test(values.dateFrom)) {
    nextSearchParams.set('dateFrom', values.dateFrom);
  } else {
    nextSearchParams.delete('dateFrom');
  }

  if (values.dateTo && DATE_PATTERN.test(values.dateTo)) {
    nextSearchParams.set('dateTo', values.dateTo);
  } else {
    nextSearchParams.delete('dateTo');
  }

  return nextSearchParams.toString();
}

export function getHistoryActionFilterOptions(): HistoryActionFilterOption[] {
  return historyRunActions
    .map(action => ({
      value: action,
      label: formatHistoryActionLabel(action),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export type DateRangePreset = 'today' | 'yesterday' | 'last_7_days' | 'last_30_days';

export interface DateRangePresetOption {
  value: DateRangePreset;
  label: string;
}

export const dateRangePresets: DateRangePresetOption[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
];

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function resolveDateRangePreset(preset: DateRangePreset, now: Date = new Date()): { from: string; to: string } {
  const today = formatDate(now);

  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: formatDate(yesterday), to: formatDate(yesterday) };
    }
    case 'last_7_days': {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { from: formatDate(weekAgo), to: today };
    }
    case 'last_30_days': {
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return { from: formatDate(monthAgo), to: today };
    }
  }
}

import {
  isHistoryRunAction,
  isHistoryRunTrigger,
  type HistoryRunAction,
  type HistoryRunTrigger,
} from '@/lib/history-types';

export type HistoryPageSearchParams = Record<string, string | string[] | undefined>;

export interface ResolvedHistoryFilters {
  search: string;
  action: HistoryRunAction | null;
  trigger: HistoryRunTrigger | null;
  hasFilters: boolean;
}

export interface HistoryFilterFormValues {
  search: string;
  action: string | null;
  trigger: string | null;
}

function getSingleSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function resolveHistoryFilters(searchParams: HistoryPageSearchParams | undefined): ResolvedHistoryFilters {
  const search = getSingleSearchParam(searchParams?.q)?.trim() ?? '';
  const actionParam = getSingleSearchParam(searchParams?.action);
  const triggerParam = getSingleSearchParam(searchParams?.trigger);
  const action = actionParam && isHistoryRunAction(actionParam) ? actionParam : null;
  const trigger = triggerParam && isHistoryRunTrigger(triggerParam) ? triggerParam : null;

  return {
    search,
    action,
    trigger,
    hasFilters: search.length > 0 || action !== null || trigger !== null,
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

  return nextSearchParams.toString();
}

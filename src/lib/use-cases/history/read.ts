import { getHistoryRunDetails, listHistoryRuns, listHistoryActivity, type HistoryActivityFilters, type HistoryActivityRecord, type HistoryRunListFilters, type HistoryRunDetails, type HistoryRunRecord } from '@/lib/history-store';

export interface ListRecentHistoryParams extends HistoryRunListFilters {
  limit?: number;
}

export interface RecentHistoryResource {
  count: number;
  runs: HistoryRunRecord[];
}

export interface GetHistoryRunParams {
  runId: string;
}

export type HistoryRunResource = HistoryRunDetails;

export interface HistoryReadDeps {
  listHistoryRuns(limit: number, filters?: HistoryRunListFilters): Promise<HistoryRunRecord[]>;
  getHistoryRunDetails(runId: string): Promise<HistoryRunDetails | null>;
}

const defaultDeps: HistoryReadDeps = {
  listHistoryRuns,
  getHistoryRunDetails,
};

export async function listRecentHistoryResource(
  params: ListRecentHistoryParams = {},
  deps: Pick<HistoryReadDeps, 'listHistoryRuns'> = defaultDeps,
): Promise<RecentHistoryResource> {
  const { limit = 25, ...filters } = params;
  const runs = Object.keys(filters).length ? await deps.listHistoryRuns(limit, filters) : await deps.listHistoryRuns(limit);

  return {
    count: runs.length,
    runs,
  };
}

export async function getHistoryRunResource(
  params: GetHistoryRunParams,
  deps: Pick<HistoryReadDeps, 'getHistoryRunDetails'> = defaultDeps,
): Promise<HistoryRunResource> {
  const details = await deps.getHistoryRunDetails(params.runId);
  if (!details) {
    throw new Error(`History run ${params.runId} was not found.`);
  }

  return details;
}


export interface ListHistoryActivityParams extends HistoryActivityFilters { limit?: number }
export async function listHistoryActivityResource(params: ListHistoryActivityParams = {},
  read: (limit: number, filters: HistoryActivityFilters) => Promise<HistoryActivityRecord[]> = listHistoryActivity) {
  const { limit = 50, ...filters } = params;
  const found = await read(limit + 1, filters);
  const entries = found.slice(0, limit);
  return { count: entries.length, entries, offset: filters.offset ?? 0, hasMore: found.length > limit };
}

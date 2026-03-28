import { getHistoryRunDetails, listHistoryRuns, type HistoryRunDetails, type HistoryRunRecord } from '@/lib/history-store';

export interface ListRecentHistoryParams {
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
  listHistoryRuns(limit: number): Promise<HistoryRunRecord[]>;
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
  const runs = await deps.listHistoryRuns(params.limit ?? 25);

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

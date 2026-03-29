import Link from 'next/link';
import { ArrowLeft, ExternalLink, History as HistoryIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buttonVariants } from '@/components/ui/button-styles';
import { config } from '@/lib/config';
import { formatDateTime } from '@/lib/date-time';
import { formatHistoryActionLabel, formatHistoryTriggerLabel } from '@/lib/history-events';
import {
  getHistoryFeatureState,
  listHistoryRuns,
} from '@/lib/history-store';
import { HistoryDisabledState, HistoryStatusBadge } from '@/components/history/HistoryShared';
import { resolveHistoryFilters } from './history-filters';
import { HistoryFiltersBar } from './HistoryFiltersBar';

function formatDurationMs(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

export const dynamic = 'force-dynamic';

export default async function HistoryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined> | undefined>;
}) {
  const historyState = getHistoryFeatureState();

  if (!historyState.enabled) {
    return <HistoryDisabledState />;
  }

  const { search, action, trigger, hasFilters } = resolveHistoryFilters(await searchParams);
  const runs = await listHistoryRuns(100, {
    search,
    action,
    trigger,
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">History</h1>
            <p className="text-sm text-muted-foreground">Operational audit trail for sync runs and manual actions across the web UI and MCP server</p>
          </div>
          <Link href="/" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HistoryIcon className="size-4" />
              Retention
            </CardTitle>
            <CardDescription>Stored for {historyState.retentionDays} day{historyState.retentionDays === 1 ? '' : 's'} via <code>HISTORY_RETENTION_DAYS</code>.</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Runs</CardTitle>
            <CardDescription>
              {runs.length === 0
                ? 'No history entries have been recorded yet.'
                : hasFilters
                  ? `Showing ${runs.length} filtered run${runs.length === 1 ? '' : 's'}.`
                  : `Showing ${runs.length} most recent run${runs.length === 1 ? '' : 's'}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HistoryFiltersBar search={search} action={action} trigger={trigger} />

            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {hasFilters
                  ? 'No history runs match the current filters.'
                  : 'No sync or manual actions have been recorded yet.'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map(run => (
                    <TableRow key={run.id}>
                      <TableCell>{formatDateTime(run.startedAt, { timeZone: config.timeZone, locale: config.timeZoneLocale })}</TableCell>
                      <TableCell>{formatHistoryActionLabel(run.action)}</TableCell>
                      <TableCell>{formatHistoryTriggerLabel(run.trigger)}</TableCell>
                      <TableCell><HistoryStatusBadge status={run.status} /></TableCell>
                      <TableCell>{formatDurationMs(run.finishedAt.getTime() - run.startedAt.getTime())}</TableCell>
                      <TableCell>{run.eventCount}</TableCell>
                      <TableCell className="max-w-xs whitespace-normal text-sm text-muted-foreground">
                        {run.message ?? 'No summary message'}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/history/${run.id}`}
                          className={buttonVariants({ variant: 'outline', size: 'sm' })}
                        >
                          <ExternalLink className="size-4" />
                          Details
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

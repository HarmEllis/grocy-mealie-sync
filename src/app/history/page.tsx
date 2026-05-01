import Link from 'next/link';
import { ExternalLink, History as HistoryIcon } from 'lucide-react';
import { AppCard } from '@/components/redesign/primitives';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buttonVariants } from '@/components/ui/button-styles';
import { config } from '@/lib/config';
import { formatDateTime } from '@/lib/date-time';
import { formatHistoryActionLabel, formatHistoryTriggerLabel } from '@/lib/history-events';
import { getHistoryFeatureState, listHistoryRuns } from '@/lib/history-store';
import { HistoryDisabledState, HistoryStatusBadge } from '@/components/history/HistoryShared';
import { PageHeader } from '@/components/layout/PageHeader';
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

  const { search, action, trigger, status, dateFrom, dateTo, hasFilters } = resolveHistoryFilters(await searchParams);
  const recentRunsForChart = await listHistoryRuns(20);
  const runs = await listHistoryRuns(100, {
    search,
    action,
    trigger,
    status,
    dateFrom: dateFrom ? new Date(dateFrom + 'T00:00:00') : null,
    dateTo: dateTo ? new Date(dateTo + 'T23:59:59.999') : null,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="History"
        subtitle={
          <>Operational audit trail for sync runs and manual actions. Retention: {historyState.retentionDays} day{historyState.retentionDays === 1 ? '' : 's'}.</>
        }
      />

      <AppCard>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold tracking-[0.05em] text-text-2 uppercase">Last 20 runs</p>
          <div className="flex items-center gap-3 text-[11px] text-text-3">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-[2px] bg-[rgba(74,222,128,0.6)]" />
              Success
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-[2px] bg-[rgba(248,113,113,0.8)]" />
              Failed
            </span>
          </div>
        </div>
        <MiniChart runs={recentRunsForChart} />
      </AppCard>

      <AppCard className="p-0">
        <div className="border-b border-border px-4 py-3">
          <HistoryFiltersBar
            search={search}
            action={action}
            trigger={trigger}
            status={status}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
          <p className="mt-2 text-xs text-text-3">
            {runs.length === 0
              ? 'No history entries have been recorded yet.'
              : hasFilters
                ? `Showing ${runs.length} filtered run${runs.length === 1 ? '' : 's'}.`
                : `Showing ${runs.length} most recent run${runs.length === 1 ? '' : 's'}.`}
          </p>
        </div>

        {runs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {hasFilters
              ? 'No history runs match the current filters.'
              : 'No sync or manual actions have been recorded yet.'}
          </p>
        ) : (
          <Table className="min-w-[980px]">
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
                <TableRow key={run.id} className="group">
                  <TableCell className="font-mono text-xs text-text-2">
                    {formatDateTime(run.startedAt, { timeZone: config.timeZone, locale: config.timeZoneLocale })}
                  </TableCell>
                  <TableCell className="font-semibold">{formatHistoryActionLabel(run.action)}</TableCell>
                  <TableCell>{formatHistoryTriggerLabel(run.trigger)}</TableCell>
                  <TableCell><HistoryStatusBadge status={run.status} /></TableCell>
                  <TableCell className="font-mono text-xs text-text-2">{formatDurationMs(run.finishedAt.getTime() - run.startedAt.getTime())}</TableCell>
                  <TableCell>{run.eventCount}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {run.message ?? 'No summary message'}
                  </TableCell>
                  <TableCell>
                    <Link href={`/history/${run.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                      <ExternalLink className="size-4" />
                      Details
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AppCard>

      <div className="flex">
        <Link href="/" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <HistoryIcon className="size-4" />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function MiniChart({ runs }: { runs: Awaited<ReturnType<typeof listHistoryRuns>> }) {
  const maxWidth = 460;
  const barGap = 2;
  const chartHeight = 36;
  const barWidth = Math.max(4, Math.floor((maxWidth / Math.max(1, runs.length)) - barGap));

  if (runs.length === 0) {
    return <p className="text-xs text-text-3">No data yet.</p>;
  }

  return (
    <svg width="100%" viewBox={`0 0 ${maxWidth} ${chartHeight}`} className="h-9 w-full max-w-[460px]">
      {runs.map((run, index) => {
        const ok = run.status === 'success' || run.status === 'partial';
        const x = index * (barWidth + barGap);
        const height = ok ? 28 : 36;
        const y = chartHeight - height;

        return (
          <rect
            key={run.id}
            x={x}
            y={y}
            width={barWidth}
            height={height}
            rx={2}
            fill={ok ? 'rgba(74,222,128,0.5)' : 'rgba(248,113,113,0.7)'}
          />
        );
      })}
    </svg>
  );
}

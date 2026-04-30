import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AppCard } from '@/components/redesign/primitives';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buttonVariants } from '@/components/ui/button-styles';
import { config } from '@/lib/config';
import { formatDateTime } from '@/lib/date-time';
import {
  formatHistoryActionLabel,
  formatSchedulerStepNameLabel,
  formatHistoryTriggerLabel,
  getVisibleHistoryEvents,
  normalizeHistoryEventMessage,
} from '@/lib/history-events';
import { getHistoryFeatureState, getHistoryRunDetails } from '@/lib/history-store';
import { HistoryDisabledState, HistoryStatusBadge, JsonBlock } from '@/components/history/HistoryShared';

interface HistoryDetailPageProps {
  params: Promise<{
    runId: string;
  }>;
}

interface SchedulerStepSummary {
  name: 'product_sync' | 'mealie_to_grocy' | 'grocy_to_mealie' | 'conflict_check';
  status: 'success' | 'partial' | 'failure' | 'skipped';
  error?: string;
}

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

export default async function HistoryDetailPage({ params }: HistoryDetailPageProps) {
  const historyState = getHistoryFeatureState();

  if (!historyState.enabled) {
    return <HistoryDisabledState />;
  }

  const { runId } = await params;
  const details = await getHistoryRunDetails(runId);

  if (!details) {
    notFound();
  }

  const durationMs = details.run.finishedAt.getTime() - details.run.startedAt.getTime();
  const visibleEvents = getVisibleHistoryEvents(details.events);
  const hiddenEventCount = details.events.length - visibleEvents.length;
  const schedulerSteps = getSchedulerSteps(details.run.summary);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text-1">{formatHistoryActionLabel(details.run.action)}</h1>
          <p className="mt-1 font-mono text-xs text-text-3">{details.run.id}</p>
        </div>

        <Link href="/history" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <ArrowLeft className="size-4" />
          Back to history
        </Link>
      </div>

      <AppCard>
        <h2 className="text-base font-bold tracking-tight">Run summary</h2>
        <p className="mt-1 text-sm text-text-2">{details.run.message ?? 'No summary message recorded.'}</p>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SummaryItem label="Action" value={formatHistoryActionLabel(details.run.action)} />
          <SummaryItem label="Trigger" value={formatHistoryTriggerLabel(details.run.trigger)} />
          <SummaryItem label="Status" value={<HistoryStatusBadge status={details.run.status} />} />
          <SummaryItem label="Duration" value={formatDurationMs(durationMs)} mono />
          <SummaryItem
            label="Started"
            value={formatDateTime(details.run.startedAt, { timeZone: config.timeZone, locale: config.timeZoneLocale })}
            mono
          />
          <SummaryItem
            label="Finished"
            value={formatDateTime(details.run.finishedAt, { timeZone: config.timeZone, locale: config.timeZoneLocale })}
            mono
          />
        </div>
      </AppCard>

      {schedulerSteps.length > 0 ? (
        <AppCard className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-bold tracking-tight">Scheduler steps</h2>
            <p className="text-sm text-text-2">Per-step result for this scheduler cycle.</p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Step</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedulerSteps.map(step => (
                <TableRow key={step.name}>
                  <TableCell className="font-semibold">{formatSchedulerStepNameLabel(step.name)}</TableCell>
                  <TableCell><HistoryStatusBadge status={step.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{step.error ?? 'No error'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AppCard>
      ) : null}

      <AppCard>
        <h2 className="text-base font-bold tracking-tight">Summary data</h2>
        <p className="mt-1 text-sm text-text-2">Stored run payload for auditing and debugging.</p>

        <details className="mt-3 rounded-md border border-border bg-bg-2 p-2">
          <summary className="cursor-pointer text-xs font-semibold">View summary payload</summary>
          <div className="mt-2">
            <JsonBlock value={details.run.summary} />
          </div>
        </details>
      </AppCard>

      <AppCard className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-bold tracking-tight">Events</h2>
          <p className="text-sm text-text-2">
            {visibleEvents.length} event{visibleEvents.length === 1 ? '' : 's'} shown
            {hiddenEventCount > 0 ? ` (${hiddenEventCount} generic step entries hidden)` : ''}.
          </p>
        </div>

        {visibleEvents.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No detail events were recorded for this run.</p>
        ) : (
          <Table className="min-w-[1040px]">
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleEvents.map(event => (
                <TableRow key={event.id}>
                  <TableCell className="font-mono text-xs text-text-2">
                    {formatDateTime(event.createdAt, { timeZone: config.timeZone, locale: config.timeZoneLocale })}
                  </TableCell>
                  <TableCell className="uppercase text-xs text-muted-foreground">{event.level}</TableCell>
                  <TableCell>{event.category}</TableCell>
                  <TableCell className="max-w-md whitespace-normal">{normalizeHistoryEventMessage(event.message)}</TableCell>
                  <TableCell className="max-w-md whitespace-normal">
                    {event.details === null ? (
                      <span className="text-xs text-muted-foreground">No details</span>
                    ) : (
                      <details className="rounded-md border border-border bg-bg-2 p-2">
                        <summary className="cursor-pointer text-xs font-semibold">View payload</summary>
                        <div className="mt-2">
                          <JsonBlock value={event.details} />
                        </div>
                      </details>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AppCard>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold tracking-[0.06em] text-text-3 uppercase">{label}</p>
      <div className={mono ? 'mt-1 font-mono text-sm text-text-1' : 'mt-1 text-sm font-semibold text-text-1'}>{value}</div>
    </div>
  );
}

function getSchedulerSteps(summary: unknown): SchedulerStepSummary[] {
  if (!summary || typeof summary !== 'object' || !('steps' in summary)) {
    return [];
  }

  const rawSteps = (summary as { steps?: unknown }).steps;
  if (!Array.isArray(rawSteps)) {
    return [];
  }

  return rawSteps.flatMap((step): SchedulerStepSummary[] => {
    if (!step || typeof step !== 'object') {
      return [];
    }

    const name = (step as { name?: unknown }).name;
    const status = (step as { status?: unknown }).status;
    const error = (step as { error?: unknown }).error;

    if (
      (name !== 'product_sync' && name !== 'mealie_to_grocy' && name !== 'grocy_to_mealie' && name !== 'conflict_check')
      || (status !== 'success' && status !== 'partial' && status !== 'failure' && status !== 'skipped')
    ) {
      return [];
    }

    return [{
      name,
      status,
      error: typeof error === 'string' ? error : undefined,
    }];
  });
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{formatHistoryActionLabel(details.run.action)}</h1>
            <p className="text-sm text-muted-foreground">{details.run.id}</p>
          </div>
          <Link href="/history" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <ArrowLeft className="size-4" />
            Back to History
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Run Summary</CardTitle>
            <CardDescription>{details.run.message ?? 'No summary message recorded.'}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Action</p>
              <p className="text-sm font-medium">{formatHistoryActionLabel(details.run.action)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Trigger</p>
              <p className="text-sm font-medium">{formatHistoryTriggerLabel(details.run.trigger)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
              <HistoryStatusBadge status={details.run.status} />
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Duration</p>
              <p className="text-sm font-medium">{formatDurationMs(durationMs)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Started</p>
              <p className="text-sm font-medium">{formatDateTime(details.run.startedAt, { timeZone: config.timeZone, locale: config.timeZoneLocale })}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Finished</p>
              <p className="text-sm font-medium">{formatDateTime(details.run.finishedAt, { timeZone: config.timeZone, locale: config.timeZoneLocale })}</p>
            </div>
          </CardContent>
        </Card>

        {schedulerSteps.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Scheduler Steps</CardTitle>
              <CardDescription>Per-step result for this scheduler cycle.</CardDescription>
            </CardHeader>
            <CardContent>
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
                      <TableCell>{formatSchedulerStepNameLabel(step.name)}</TableCell>
                      <TableCell><HistoryStatusBadge status={step.status} /></TableCell>
                      <TableCell className="max-w-md whitespace-normal text-sm text-muted-foreground">
                        {step.error ?? 'No error'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Summary Data</CardTitle>
            <CardDescription>Stored run payload for auditing and debugging.</CardDescription>
          </CardHeader>
          <CardContent>
            <details className="rounded-md border bg-muted/30 p-2">
              <summary className="cursor-pointer text-xs font-medium">View summary payload</summary>
              <div className="mt-2">
                <JsonBlock value={details.run.summary} />
              </div>
            </details>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
            <CardDescription>
              {visibleEvents.length} event{visibleEvents.length === 1 ? '' : 's'} shown for this run
              {hiddenEventCount > 0 ? ` (${hiddenEventCount} generic step entr${hiddenEventCount === 1 ? 'y' : 'ies'} hidden).` : '.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {visibleEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No detail events were recorded for this run.</p>
            ) : (
              <Table>
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
                      <TableCell>{formatDateTime(event.createdAt, { timeZone: config.timeZone, locale: config.timeZoneLocale })}</TableCell>
                      <TableCell className="uppercase text-xs text-muted-foreground">{event.level}</TableCell>
                      <TableCell>{event.category}</TableCell>
                      <TableCell className="max-w-md whitespace-normal">{normalizeHistoryEventMessage(event.message)}</TableCell>
                      <TableCell className="max-w-md whitespace-normal">
                        {event.details === null ? (
                          <span className="text-xs text-muted-foreground">No details</span>
                        ) : (
                          <details className="rounded-md border bg-muted/30 p-2">
                            <summary className="cursor-pointer text-xs font-medium">View payload</summary>
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
          </CardContent>
        </Card>
      </div>
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

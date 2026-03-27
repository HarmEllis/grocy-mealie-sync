import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buttonVariants } from '@/components/ui/button-styles';
import { config } from '@/lib/config';
import { formatDateTime } from '@/lib/date-time';
import { formatHistoryActionLabel, formatHistoryTriggerLabel } from '@/lib/history-events';
import { getHistoryFeatureState, getHistoryRunDetails } from '@/lib/history-store';
import { HistoryDisabledState, HistoryStatusBadge, JsonBlock } from '@/components/history/HistoryShared';

interface HistoryDetailPageProps {
  params: Promise<{
    runId: string;
  }>;
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

        <Card>
          <CardHeader>
            <CardTitle>Summary Data</CardTitle>
            <CardDescription>Stored run payload for auditing and debugging.</CardDescription>
          </CardHeader>
          <CardContent>
            <JsonBlock value={details.run.summary} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
            <CardDescription>{details.events.length} event{details.events.length === 1 ? '' : 's'} recorded for this run.</CardDescription>
          </CardHeader>
          <CardContent>
            {details.events.length === 0 ? (
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
                  {details.events.map(event => (
                    <TableRow key={event.id}>
                      <TableCell>{formatDateTime(event.createdAt, { timeZone: config.timeZone, locale: config.timeZoneLocale })}</TableCell>
                      <TableCell className="uppercase text-xs text-muted-foreground">{event.level}</TableCell>
                      <TableCell>{event.category}</TableCell>
                      <TableCell className="max-w-md whitespace-normal">{event.message}</TableCell>
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

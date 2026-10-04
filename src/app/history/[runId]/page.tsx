import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppCard } from '@/components/redesign/primitives';
import { buttonVariants } from '@/components/ui/button-styles';
import { formatHistoryActionLabel, formatHistoryTriggerLabel } from '@/lib/history-events';
import { getHistoryFeatureState, getHistoryRunDetails } from '@/lib/history-store';
import { HistoryDisabledState, HistoryStatusBadge, JsonBlock } from '@/components/history/HistoryShared';
import { HistoryActivityCard } from '@/components/history/HistoryActivityCard';
import { PageHeader } from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';

export default async function HistoryDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  if (!getHistoryFeatureState().enabled) return <HistoryDisabledState />;
  const { runId } = await params;
  const details = await getHistoryRunDetails(runId);
  if (!details) notFound();
  const activity = details.events.filter(event => event.kind !== 'diagnostic');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Related changes" subtitle={`${formatHistoryActionLabel(details.run.action)} · ${formatHistoryTriggerLabel(details.run.trigger)}`} />
        <Link href="/history" className={buttonVariants({ variant: 'outline', size: 'sm' })}>Back to history</Link>
      </div>
      <AppCard className="p-0">
        {activity.length ? activity.map(event => (
          <HistoryActivityCard key={event.id} event={event} trigger={details.run.trigger} showRunLink={false} />
        )) : <p className="px-5 py-6 text-sm text-text-3">This older entry contains only a run summary. Product-level changes were not recorded.</p>}
      </AppCard>
      <details className="rounded-lg border border-border bg-bg-1 p-4 text-sm">
        <summary className="cursor-pointer font-semibold text-text-2">Run diagnostics</summary>
        <div className="mt-4 space-y-3">
          <HistoryStatusBadge status={details.run.status} />
          <p className="text-text-2">{details.run.message}</p>
          <JsonBlock value={{ run: details.run, events: details.events }} />
        </div>
      </details>
    </div>
  );
}

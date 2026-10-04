import Link from 'next/link';
import { ArrowRight, Check, TriangleAlert, ScanBarcode } from 'lucide-react';
import { config } from '@/lib/config';
import { formatDateTime } from '@/lib/date-time';
import { formatHistoryTriggerLabel } from '@/lib/history-events';
import type { HistoryEventRecord } from '@/lib/history-store';
import type { HistoryRunTrigger } from '@/lib/history-types';
import { JsonBlock } from './HistoryShared';

export function HistoryActivityCard({ event, trigger, showRunLink = true }: {
  event: HistoryEventRecord;
  trigger: HistoryRunTrigger;
  showRunLink?: boolean;
}) {
  const issue = event.kind === 'issue';
  const Icon = issue ? TriangleAlert : trigger === 'scanner' ? ScanBarcode : Check;
  const iconColor = issue ? event.level === 'error' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300' : 'bg-amber-500/10 text-amber-600 dark:text-amber-300' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
  return (
    <article id={event.id} className="flex gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:gap-4 sm:px-5">
      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${iconColor}`}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-2">
          <span className="font-semibold">{issue ? event.level === 'error' ? 'Error' : 'Warning' : 'Changed'}</span>
          <span>{formatHistoryTriggerLabel(trigger)}</span>
          {event.source && event.target && (
            <span className="inline-flex items-center gap-1 font-medium text-text-2">
              {event.source}<ArrowRight className="size-3" aria-label="to" />{event.target}
            </span>
          )}
          <time dateTime={event.createdAt.toISOString()} className="sm:ml-auto">
            {formatDateTime(event.createdAt, { timeZone: config.timeZone, locale: config.timeZoneLocale })}
          </time>
        </div>
        <p className="text-sm font-semibold break-words text-text-1">{event.message}</p>
        {event.reason && <p className="text-sm break-words text-text-2">{event.reason}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          {event.productName && (
            <Link href={`/history?q=${encodeURIComponent(event.productName)}`} className="font-medium text-primary hover:underline">
              All activity for {event.productName}
            </Link>
          )}
          {showRunLink && <Link href={`/history/${event.runId}#${event.id}`} className="text-text-3 hover:underline">Related changes</Link>}
        </div>
        {event.details != null && (
          <details className="text-xs text-text-3">
            <summary className="w-fit cursor-pointer">Details</summary>
            <div className="mt-2"><JsonBlock value={event.details} /></div>
          </details>
        )}
      </div>
    </article>
  );
}

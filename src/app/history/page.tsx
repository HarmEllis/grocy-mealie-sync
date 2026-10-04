import Link from 'next/link';
import { AppCard } from '@/components/redesign/primitives';
import { buttonVariants } from '@/components/ui/button-styles';
import { getHistoryFeatureState, listHistoryActivity } from '@/lib/history-store';
import { HistoryDisabledState } from '@/components/history/HistoryShared';
import { HistoryActivityCard } from '@/components/history/HistoryActivityCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { resolveHistoryFilters } from './history-filters';
import { HistoryFiltersBar } from './HistoryFiltersBar';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 50;

export default async function HistoryPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined> | undefined>;
}) {
  const historyState = getHistoryFeatureState();
  if (!historyState.enabled) return <HistoryDisabledState />;

  const params = await searchParams;
  const filters = resolveHistoryFilters(params);
  const requestedPage = Number(Array.isArray(params?.page) ? params.page[0] : params?.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
  const entries = await listHistoryActivity(PAGE_SIZE + 1, {
    ...filters,
    dateFrom: filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00') : null,
    dateTo: filters.dateTo ? new Date(filters.dateTo + 'T23:59:59.999') : null,
    offset: (page - 1) * PAGE_SIZE,
  });
  const hasNextPage = entries.length > PAGE_SIZE;
  const activity = entries.slice(0, PAGE_SIZE);
  function pageHref(nextPage: number) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (typeof value === 'string') query.set(key, value);
      else if (Array.isArray(value) && value[0]) query.set(key, value[0]);
    }
    query.set('page', String(nextPage));
    return `/history?${query}`;
  }

  return (
    <div className="space-y-4">
      <PageHeader title="History" subtitle={
        <>What changed, why it changed, and what went wrong. Sync, manual and scanner actions are kept for {historyState.retentionDays} days.</>
      } />
      <AppCard className="p-0">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <HistoryFiltersBar {...filters} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-3">
            <p>{activity.length} {filters.hasFilters ? 'matching' : 'recent'} change{activity.length === 1 ? '' : 's'} and issue{activity.length === 1 ? '' : 's'}</p>
            <p>Checks without changes are hidden.</p>
            {filters.hasFilters && <Link href="/history" className="text-primary hover:underline">Clear filters</Link>}
          </div>
        </div>
        {activity.length ? activity.map(event => (
          <HistoryActivityCard key={event.id} event={event} trigger={event.trigger} />
        )) : (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-semibold text-text-1">{filters.hasFilters ? 'No changes or issues match these filters.' : 'No changes or issues recorded yet.'}</p>
            <p className="mt-2 text-sm text-text-3">{filters.hasFilters ? 'Try another product name or a wider date range.' : 'Stock changes, shopping list updates and scanner actions will appear here when they happen.'}</p>
          </div>
        )}
      </AppCard>
      {(page > 1 || hasNextPage) && (
        <nav aria-label="History pages" className="flex items-center justify-between gap-3">
          {page > 1 ? <Link href={pageHref(page - 1)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>Newer activity</Link> : <span />}
          <span className="text-xs text-text-3">Page {page}</span>
          {hasNextPage ? <Link href={pageHref(page + 1)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>Older activity</Link> : <span />}
        </nav>
      )}
    </div>
  );
}

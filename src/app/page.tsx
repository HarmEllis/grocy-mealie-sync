import Link from 'next/link';
import { Link2 } from 'lucide-react';
import { count } from 'drizzle-orm';
import { AppBadge, AppCard, AppStatusDot } from '@/components/redesign/primitives';
import { buttonVariants } from '@/components/ui/button-styles';
import { db } from '@/lib/db';
import { productMappings, unitMappings } from '@/lib/db/schema';
import { config } from '@/lib/config';
import { formatDateTime } from '@/lib/date-time';
import { cn } from '@/lib/utils';
import { getSyncState } from '@/lib/sync/state';
import { getNextCleanupRun } from '@/lib/sync/scheduler';
import { getHistoryFeatureState, listHistoryRuns } from '@/lib/history-store';
import { formatHistoryActionLabel } from '@/lib/history-events';
import type { HistoryRunRecord } from '@/lib/history-store';
import { DashboardSyncPanel } from '@/components/sync/DashboardSyncPanel';

interface DashboardStatus {
  lastGrocyPoll: string | Date | null;
  lastMealiePoll: string | Date | null;
  grocyBelowMinStockCount: number;
  mealieTrackedItemsCount: number;
  productMappings: number;
  unitMappings: number;
  nextCleanupRun: string | Date | null;
}

async function getStatus(): Promise<DashboardStatus | null> {
  try {
    const state = await getSyncState();
    const [productCount] = await db.select({ count: count() }).from(productMappings);
    const [unitCount] = await db.select({ count: count() }).from(unitMappings);

    return {
      lastGrocyPoll: state.lastGrocyPoll,
      lastMealiePoll: state.lastMealiePoll,
      grocyBelowMinStockCount: Object.keys(state.grocyBelowMinStock).length,
      mealieTrackedItemsCount: Object.keys(state.mealieCheckedItems).length,
      productMappings: productCount.count,
      unitMappings: unitCount.count,
      nextCleanupRun: await getNextCleanupRun(),
    };
  } catch {
    return null;
  }
}

function runDuration(run: HistoryRunRecord): string {
  const durationMs = run.finishedAt.getTime() - run.startedAt.getTime();

  if (durationMs < 1000) {
    return '<1s';
  }

  return `${Math.round(durationMs / 1000)}s`;
}

function formatNextRunIn(lastPoll: string | Date | null): string {
  if (!lastPoll) {
    return 'Unknown';
  }

  const lastPollTime = new Date(lastPoll);
  if (Number.isNaN(lastPollTime.getTime())) {
    return 'Unknown';
  }

  const nextRunAt = lastPollTime.getTime() + (config.pollIntervalSeconds * 1000);
  const remainingMs = Math.max(0, nextRunAt - Date.now());
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export const dynamic = 'force-dynamic';

export default async function Home() {
  const status = await getStatus();
  const historyState = getHistoryFeatureState();
  const recentRuns = historyState.enabled ? await listHistoryRuns(4) : [];
  const mostRecentPoll = status
    ? [status.lastGrocyPoll, status.lastMealiePoll]
      .filter((value): value is string | Date => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null
    : null;

  return (
    <div className="space-y-5">
      <AppCard>
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <AppStatusDot status={status ? 'success' : 'warning'} />
            <span className="text-sm font-semibold text-text-1">
              {status ? 'Sync healthy' : 'Status unavailable'}
            </span>
          </div>

          <div className="flex flex-wrap gap-6">
            <StatusMeta
              label="Last Grocy job"
              value={formatDateTime(status?.lastGrocyPoll ?? null, {
                fallback: 'Never',
                locale: config.timeZoneLocale,
                timeZone: config.timeZone,
              })}
            />
            <StatusMeta
              label="Last Mealie job"
              value={formatDateTime(status?.lastMealiePoll ?? null, {
                fallback: 'Never',
                locale: config.timeZoneLocale,
                timeZone: config.timeZone,
              })}
            />
            <StatusMeta
              label="Next run in"
              value={formatNextRunIn(mostRecentPoll)}
            />
            <StatusMeta
              label="Next cleanup"
              value={formatDateTime(status?.nextCleanupRun ?? null, {
                fallback: 'Unknown',
                locale: config.timeZoneLocale,
                timeZone: config.timeZone,
              })}
            />
          </div>
        </div>
      </AppCard>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Grocy low-stock" value={status?.grocyBelowMinStockCount ?? 0} icon="📦" tone="warning" />
        <StatCard label="Mealie tracked" value={status?.mealieTrackedItemsCount ?? 0} icon="🍽" tone="accent" />
        <StatCard label="Mapped products" value={status?.productMappings ?? 0} icon="🔗" tone="success" />
        <StatCard label="Mapped units" value={status?.unitMappings ?? 0} icon="⚖" tone="default" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AppCard>
          <div className="mb-4">
            <h2 className="text-base font-bold tracking-tight">Manual Sync</h2>
            <p className="text-sm text-muted-foreground">Trigger targeted sync steps directly from the dashboard.</p>
          </div>
          <DashboardSyncPanel />
        </AppCard>

        <AppCard>
          <div className="mb-4">
            <h2 className="text-base font-bold tracking-tight">Last Sync Overview</h2>
            <p className="text-sm text-muted-foreground">Recent scheduler and manual actions.</p>
          </div>

          <div className="space-y-2">
            {recentRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No runs recorded yet.</p>
            ) : (
              recentRuns.map(run => (
                <div key={run.id} className="flex items-center justify-between rounded-lg border border-border bg-bg-2 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <AppStatusDot
                      status={run.status === 'failure' ? 'error' : run.status === 'partial' ? 'warning' : 'success'}
                    />
                    <span className="truncate text-sm font-semibold">{formatHistoryActionLabel(run.action)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-2">
                    <AppBadge small>{runDuration(run)}</AppBadge>
                    <AppBadge small>{run.eventCount} events</AppBadge>
                  </div>
                </div>
              ))
            )}
          </div>

          {historyState.enabled ? (
            <div className="mt-3">
              <Link
                href="/history"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'w-full justify-center border-border bg-transparent text-text-2 hover:bg-bg-2 hover:text-text-1',
                )}
              >
                View full history →
              </Link>
            </div>
          ) : null}
        </AppCard>
      </div>

      <AppCard className="bg-[linear-gradient(135deg,var(--accent-subtle)_0%,var(--bg-1)_100%)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold tracking-tight">
              {(status?.grocyBelowMinStockCount ?? 0) > 0
                ? `${status?.grocyBelowMinStockCount ?? 0} items currently below minimum stock`
                : 'Review product mappings'}
            </h2>
            <p className="mt-1 text-sm text-text-2">
              Open the mapping workspace to review suggestions, resolve conflicts, and keep sync actions clean.
            </p>
          </div>
          <Link href="/mapping" className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'font-semibold')}>
            <Link2 className="size-4" />
            Open Product Mapping
          </Link>
        </div>
      </AppCard>

    </div>
  );
}

function StatusMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold tracking-[0.05em] text-text-3 uppercase">{label}</p>
      <p className="font-mono text-sm font-semibold text-text-1">{value}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: string;
  tone: 'default' | 'success' | 'warning' | 'accent';
}) {
  const valueClass = {
    default: 'text-text-1',
    success: 'text-success',
    warning: 'text-warning',
    accent: 'text-primary',
  }[tone];

  return (
    <AppCard className="px-5 py-4">
      <p className="text-2xl">{icon}</p>
      <p className={cn('font-mono text-3xl font-bold leading-tight', valueClass)}>{value}</p>
      <p className="mt-1 text-xs text-text-2">{label}</p>
    </AppCard>
  );
}

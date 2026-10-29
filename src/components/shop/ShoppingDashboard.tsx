'use client';

import { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, Package, Receipt, RefreshCw, TriangleAlert, History } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppBadge } from '@/components/redesign/primitives';
import { apiJson } from './api';
import { OwnProductsTab } from './OwnProductsTab';
import { attentionCount, pausedLines, post } from './shop-common';
import { KpiTile, PluginChip, Spinner, StatusHero } from './shop-ui';
import { DiagnosticsTab } from './tabs/DiagnosticsTab';
import { OverviewTab } from './tabs/OverviewTab';
import { ReceiptsTab } from './tabs/ReceiptsTab';
import { ReviewTab } from './tabs/ReviewTab';
import type { ShopOverview } from '@/lib/shop/overview';

type Tab = 'overview' | 'products' | 'receipts' | 'review' | 'diagnostics';

const TAB_CLASS = 'rounded-none border-b-2 border-transparent px-4 py-2 data-active:border-primary data-active:text-primary';

export function ShoppingDashboard({ timeZone = null, locale = null }: { timeZone?: string | null; locale?: string | null }) {
  const [overview, setOverview] = useState<ShopOverview | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<ShopOverview>('/api/shop/overview');
      if (!Array.isArray(data?.installations)) throw new Error('Unexpected response');
      setOverview(data);
    } catch (error) {
      toast.error('Could not load shopping data', { description: (error as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(load, 30_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const attention = attentionCount(overview);
  const sent = overview?.exports.length ?? 0;
  const blocked = overview ? (overview.projectionReview ?? []).length : 0;
  const percent = sent + blocked ? Math.round(sent / (sent + blocked) * 100) : 100;

  return (
    <div className="min-w-0 space-y-4 break-words [&_[data-slot=button]]:h-auto [&_[data-slot=button]]:min-h-10 [&_[data-slot=button]]:max-w-full [&_[data-slot=button]]:whitespace-normal md:[&_[data-slot=button]]:min-h-8">
      <div className="flex flex-wrap items-center gap-2">
        {overview?.installations.map(installation => (
          <span key={installation.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-1 py-1 pr-3 pl-1.5">
            <PluginChip name={installation.name} />
            <AppBadge small tone={installation.connected ? 'success' : 'warning'}>{installation.connected ? 'connected' : 'offline'}</AppBadge>
          </span>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {attention > 0 ? <AppBadge tone="warning">{attention} item(s) need attention</AppBadge> : null}
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Spinner /> : <RefreshCw className="size-4" />} Refresh
          </Button>
          <Button size="sm" onClick={async () => { if (await post('/api/shop/run', {}, 'Shop sync requested')) void load(); }}>
            Sync lists now
          </Button>
        </div>
      </div>

      {overview && overview.installations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No shop plugins are installed. Add one under Settings → Shop plugins. Without plugins the regular sync is unchanged.
        </p>
      ) : null}

      {overview && overview.installations.length > 0 ? (
        <StatusHero
          needsAttention={attention > 0 || blocked > 0}
          percent={percent}
          headline={attention > 0 ? `${attention} ${attention === 1 ? 'item needs' : 'items need'} your decision`
            : blocked > 0 ? `${blocked} shopping ${blocked === 1 ? 'row is' : 'rows are'} waiting` : 'Everything is in sync'}
          copy={attention > 0 || blocked > 0
            ? `${sent} of ${sent + blocked} shopping rows reached a retailer list. The rest are listed with the reason they were held back; fix the mapping or unit and the next sync retries automatically.`
            : 'Every shopping row reached its retailer list, every receipt line is settled and no write is waiting for a decision.'}
        >
          <KpiTile label="On the shared list" value={sent} foot="products exported" tone="good" onClick={() => setTab('overview')} />
          <KpiTile label="Not sent to retailer" value={blocked} foot="rows held back" tone={blocked ? 'warn' : 'none'} onClick={() => setTab('review')} />
          <KpiTile label="Receipt lines to review" value={overview.review.length} foot="nothing booked yet" tone={overview.review.length ? 'warn' : 'none'} onClick={() => setTab('review')} />
          <KpiTile label="Stock discrepancies" value={overview.discrepancies.length} foot="receipt vs. manual check" tone={overview.discrepancies.length ? 'bad' : 'none'} onClick={() => setTab('review')} />
          <KpiTile label="Writes to decide" value={overview.effects.length + pausedLines(overview).length} foot="writes and paused lines" tone={overview.effects.length ? 'warn' : 'none'} onClick={() => setTab('review')} />
        </StatusHero>
      ) : null}

      <Tabs value={tab} onValueChange={value => setTab(value as Tab)}>
        <div className="-mx-2 overflow-x-auto overflow-y-hidden border-b border-border px-2 pb-0.5">
          <TabsList variant="line" className="h-10 min-w-max gap-0 bg-transparent p-0 md:h-8">
            <TabsTrigger value="overview" className={TAB_CLASS}><LayoutDashboard className="size-3.5" /> Overview</TabsTrigger>
            <TabsTrigger value="products" className={TAB_CLASS}><Package className="size-3.5" /> Products</TabsTrigger>
            <TabsTrigger value="receipts" className={TAB_CLASS}><Receipt className="size-3.5" /> Receipts</TabsTrigger>
            <TabsTrigger value="review" className={TAB_CLASS}><TriangleAlert className="size-3.5" /> Review{attention > 0 ? ` (${attention})` : ''}</TabsTrigger>
            <TabsTrigger value="diagnostics" className={TAB_CLASS}><History className="size-3.5" /> Diagnostics</TabsTrigger>
          </TabsList>
        </div>
        <p className="text-[11px] text-text-3 md:hidden">Swipe tabs to view all sections.</p>
        <TabsContent value="overview">{overview ? <OverviewTab overview={overview} reload={load} goTo={setTab} /> : null}</TabsContent>
        <TabsContent value="products">{overview ? <OwnProductsTab overview={overview} reloadOverview={load} /> : null}</TabsContent>
        <TabsContent value="receipts">{overview ? <ReceiptsTab overview={overview} reload={load} /> : null}</TabsContent>
        <TabsContent value="review">{overview ? <ReviewTab overview={overview} reload={load} /> : null}</TabsContent>
        <TabsContent value="diagnostics"><DiagnosticsTab overview={overview} timeZone={timeZone} locale={locale} /></TabsContent>
      </Tabs>
    </div>
  );
}

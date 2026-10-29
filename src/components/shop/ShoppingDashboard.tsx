'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type TouchEvent } from 'react';
import { ArrowLeftRight, Check, History, LayoutDashboard, Package, Receipt, ShoppingCart, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { apiJson } from './api';
import { OwnProductsTab } from './OwnProductsTab';
import { attentionCount, pausedLines, post } from './shop-common';
import { DButton, EmptyState, KpiTile, ShopLogo, Spinner, StatusHero } from './shop-ui';
import { DiagnosticsTab } from './tabs/DiagnosticsTab';
import { OverviewTab } from './tabs/OverviewTab';
import { ReceiptsTab } from './tabs/ReceiptsTab';
import { ReviewTab } from './tabs/ReviewTab';
import type { ShopOverview } from '@/lib/shop/overview';
import './shop-design.css';

type Tab = 'overview' | 'products' | 'receipts' | 'review' | 'diagnostics';

const REFRESH_SECONDS = 30;
const TABS: Array<{ id: Tab; label: string; icon: ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard /> },
  { id: 'products', label: 'Products', icon: <Package /> },
  { id: 'receipts', label: 'Receipts', icon: <Receipt /> },
  { id: 'review', label: 'Review', icon: <TriangleAlert /> },
  { id: 'diagnostics', label: 'Diagnostics', icon: <History /> },
];

export function ShoppingDashboard({ timeZone = null, locale = null }: { timeZone?: string | null; locale?: string | null }) {
  const [overview, setOverview] = useState<ShopOverview | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [productsQuery, setProductsQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [nextRefresh, setNextRefresh] = useState(REFRESH_SECONDS);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    // Restart the countdown at once so a slow response cannot trigger further loads, and let only
    // the latest request update the page so an older response never overwrites newer data.
    const sequence = ++requestSequence.current;
    setNextRefresh(REFRESH_SECONDS);
    setLoading(true);
    try {
      const data = await apiJson<ShopOverview>('/api/shop/overview');
      if (!Array.isArray(data?.installations)) throw new Error('Unexpected response');
      if (sequence === requestSequence.current) setOverview(data);
    } catch (error) {
      if (sequence === requestSequence.current) toast.error('Could not load shopping data', { description: (error as Error).message });
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const interval = window.setInterval(() => setNextRefresh(seconds => seconds - 1), 1000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => { if (nextRefresh <= 0) void load(); }, [nextRefresh, load]);

  const attention = attentionCount(overview);
  const planned = overview?.exports.length ?? 0;
  const blocked = overview ? (overview.projectionReview ?? []).length : 0;
  const pending = overview?.installations.filter(installation => installation.pendingListApply).length ?? 0;
  const offline = overview?.installations.filter(installation => !installation.connected).length ?? 0;
  const noPlugins = Boolean(overview && overview.installations.length === 0);
  const needsAttention = attention > 0 || blocked > 0 || pending > 0;
  const writesToDecide = (overview?.effects.length ?? 0) + (overview ? pausedLines(overview).length : 0);
  // One priority order for the badge and the hero: decisions, then pending list writes, then held-back rows.
  // A pending write is only shown on Overview, held-back rows only on Review.
  const status = attention > 0
    ? { headline: `${attention} ${attention === 1 ? 'item needs' : 'items need'} your decision`, badge: <><strong>{attention}</strong> {attention === 1 ? 'item needs' : 'items need'} attention</>, tab: 'review' as const }
    : pending > 0
      ? { headline: pending === 1 ? 'A list write is waiting for confirmation' : `${pending} list writes are waiting for confirmation`, badge: <><strong>{pending}</strong> list write{pending === 1 ? '' : 's'} pending</>, tab: 'overview' as const }
      : blocked > 0
        ? { headline: `${blocked} shopping ${blocked === 1 ? 'row is' : 'rows are'} held back`, badge: <><strong>{blocked}</strong> held back</>, tab: 'review' as const }
        : { headline: 'Nothing needs your decision', badge: <>Nothing needs attention</>, tab: 'review' as const };

  function select(id: Tab, focus = false) {
    setTab(id);
    if (focus) window.requestAnimationFrame(() => document.getElementById(`shop-tab-${id}`)?.focus());
  }
  function openProducts(query: string) {
    setProductsQuery(query);
    select('products');
  }
  function step(direction: 1 | -1, focus = false) {
    const index = TABS.findIndex(item => item.id === tab);
    select(TABS[(index + direction + TABS.length) % TABS.length].id, focus);
  }
  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowRight') step(1, true);
    else if (event.key === 'ArrowLeft') step(-1, true);
    else if (event.key === 'Home') select(TABS[0].id, true);
    else if (event.key === 'End') select(TABS[TABS.length - 1].id, true);
    else return;
    event.preventDefault();
  }
  // React bubbles touches from portals (dialogs) too, so only gestures that start inside the
  // panel area on non-interactive content may switch tabs.
  function onSwipeStart(event: TouchEvent<HTMLDivElement>) {
    const target = event.target as Element;
    const inside = event.currentTarget.contains(target) && !target.closest('input, select, textarea, [role="dialog"], [role="combobox"], [role="listbox"]');
    swipeStart.current = inside && event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }
  function onSwipeEnd(event: TouchEvent<HTMLDivElement>) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) >= 70 && Math.abs(dy) <= 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
  }

  return (
    <div className="shop-v2 min-w-0 break-words">
      <div className="page-head" data-testid="shop-toolbar">
        <div className="head-top">
          {noPlugins ? (
            <span className="chip-hint">Plugins are added under Settings → Shop plugins.</span>
          ) : (
            <div className="toolbar">
              <button type="button" className={`attention${needsAttention ? '' : ' calm'}`} onClick={() => select(status.tab)} data-testid="attention-badge">
                {needsAttention ? <TriangleAlert className="size-4" /> : <Check className="size-4" />}
                {status.badge}
              </button>
              <div className="refresh" data-testid="refresh-control">
                <div className="refresh-meta">
                  <span>{loading ? 'Refreshing…' : 'Auto-refresh on'}</span>
                  <span>every {REFRESH_SECONDS}s · next in {Math.max(nextRefresh, 0)}s</span>
                </div>
                <button type="button" className="icon-button" onClick={() => void load()} disabled={loading} aria-label="Refresh shopping data now">
                  {loading ? <Spinner /> : <ArrowLeftRight className="size-4" />}
                </button>
              </div>
              <DButton variant="primary" onClick={async () => { if (await post('/api/shop/run', {}, 'Shop sync requested')) void load(); }}>
                <ShoppingCart className="size-4" /> Sync lists now
              </DButton>
            </div>
          )}
        </div>
        {overview && overview.installations.length > 0 ? (
          <div className="plugin-chips" data-testid="plugin-chips">
            {overview.installations.map(installation => (
              <span key={installation.id} className={`chip${installation.connected ? '' : ' down'}`}>
                <ShopLogo name={installation.name} />{installation.name}
                <span className="chip-state"><span className="dot" />{installation.connected ? 'connected' : 'offline'}</span>
              </span>
            ))}
            <span className="chip-hint">{overview.installations.length} plugin{overview.installations.length === 1 ? '' : 's'} installed</span>
          </div>
        ) : null}
      </div>

      {noPlugins ? (
        <div className="panel noplugins" data-testid="no-plugins-panel">
          <EmptyState icon={<ShoppingCart className="size-5" />} title="No shop plugins are installed">
            Add one under Settings → Shop plugins. Without plugins the regular sync is unchanged.
          </EmptyState>
        </div>
      ) : null}

      {overview && !noPlugins ? (
        <StatusHero
          needsAttention={needsAttention}
          icon={needsAttention ? <TriangleAlert className="size-6" /> : <Check className="size-6" />}
          headline={status.headline}
          copy={needsAttention
            ? 'The items below are waiting for you or were held back with a reason. Fix the mapping or unit and the next sync retries automatically.'
            : `No receipt line, write, paused line or blocked row is waiting.${offline ? ` ${offline} ${offline === 1 ? 'plugin is' : 'plugins are'} offline, so list changes wait for it to reconnect.` : ''}`}
        >
          <KpiTile label="On the shared list" value={planned} foot="products planned for the list" tone="good" onClick={() => select('overview')} />
          <KpiTile label="Not sent to retailer" value={blocked} foot="rows held back" tone={blocked ? 'warn' : ''} onClick={() => select('review')} />
          <KpiTile label="Receipt lines to review" value={overview.review.length} foot="nothing booked yet" tone={overview.review.length ? 'warn' : ''} onClick={() => select('review')} />
          <KpiTile label="Stock discrepancies" value={overview.discrepancies.length} foot="receipt vs. manual check" tone={overview.discrepancies.length ? 'bad' : ''} onClick={() => select('review')} />
          <KpiTile label="Writes to decide" value={writesToDecide} foot="writes and paused lines" tone={writesToDecide ? 'warn' : ''} onClick={() => select('review')} />
        </StatusHero>
      ) : null}

      {!noPlugins ? (
        <>
          <div className="sectabs" role="tablist" aria-label="Shopping sections" data-testid="section-tabs">
            {TABS.map(item => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`shop-tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls={`shop-panel-${item.id}`}
                tabIndex={tab === item.id ? 0 : -1}
                className="sectab"
                onClick={() => select(item.id)}
                onKeyDown={onTabKey}
              >
                <span aria-hidden="true" className="contents">{item.icon}</span>
                {item.label}
                {item.id === 'review' && attention > 0 ? <span className="count alert">{attention}</span> : null}
              </button>
            ))}
          </div>
          <div
            className="sections"
            onTouchStart={onSwipeStart}
            onTouchEnd={onSwipeEnd}
            onTouchCancel={() => { swipeStart.current = null; }}
          >
            <section role="tabpanel" id={`shop-panel-${tab}`} aria-labelledby={`shop-tab-${tab}`} className="stack">
              {!overview ? <div className="panel"><div className="skeleton" aria-hidden="true"><div className="sk w40" /><div className="sk" /><div className="sk w80" /><div className="sk w60" /></div></div> : null}
              {overview && tab === 'overview' ? <OverviewTab overview={overview} reload={load} goTo={select} openProducts={openProducts} /> : null}
              {overview && tab === 'products' ? <OwnProductsTab overview={overview} reloadOverview={load} initialQuery={productsQuery} /> : null}
              {overview && tab === 'receipts' ? <ReceiptsTab overview={overview} reload={load} /> : null}
              {overview && tab === 'review' ? <ReviewTab overview={overview} reload={load} openProducts={openProducts} goTo={select} /> : null}
              {overview && tab === 'diagnostics' ? <DiagnosticsTab overview={overview} timeZone={timeZone} locale={locale} /> : null}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}

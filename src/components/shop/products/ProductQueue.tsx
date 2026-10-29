'use client';

import { ChevronRight, Clock, Link2, Package, RefreshCw, Search, UtensilsCrossed } from 'lucide-react';
import { ThemedSelect } from '@/components/shared/ThemedSelect';
import { Pagination } from '@/components/mapping-wizard/Pagination';
import type { PageWindow } from '@/components/mapping-wizard/paging';
import type { ShopOverview } from '@/lib/shop/overview';
import type { AttentionReason, InventoryTarget, ProductSource } from '@/lib/shop/product-inventory';
import type { TargetOption } from '@/lib/shop/targets';
import { Badge, DButton, EmptyState, type BadgeTone } from '../shop-ui';
import { SourceBadge } from './ProductDetail';
import { effectiveMappings, type CatalogData, type Inventory, type Provider, type QueueTab, type StatusFilter } from './types';


const ATTENTION_BADGE: Record<AttentionReason, { label: string; tone: BadgeTone }> = {
  unit_changed: { label: 'Unit changed', tone: 'warning' },
  unconfirmed: { label: 'Unconfirmed amount', tone: 'warning' },
  discontinued: { label: 'Discontinued', tone: 'danger' },
};

export const targetKey = (target: Pick<TargetOption, 'kind' | 'id'>) => `${target.kind}:${target.id}`;

function RowIcon({ target }: { target: TargetOption }) {
  const Icon = target.source === 'grocy_mealie' ? Link2 : target.kind === 'grocy_product' ? Package : UtensilsCrossed;
  return <Icon aria-hidden="true" />;
}

/** Small facts under a row: text item, replacement still waiting, alternatives. */
function RowFlags({ target, catalog, providers }: { target: InventoryTarget; catalog: CatalogData; providers: Provider[] }) {
  // Same reading as the detail: one effective preferred mapping per retailer, everything else is an alternative.
  const resolved = providers.map(provider => effectiveMappings(catalog.mappings, provider.id, target));
  const preferred = resolved.flatMap(entry => entry.main ? [entry.main] : []);
  const flags: Array<{ key: string; tone: '' | 'warn' | 'bad'; icon: 'text' | 'clock' | 'swap' | 'bad'; text: string }> = [];
  if (target.attention.includes('discontinued')) flags.push({ key: 'discontinued', tone: 'bad', icon: 'bad', text: 'List sync needs a text item or a new preferred product' });
  const noteAccounts = providers.flatMap(provider => provider.installations.filter(installation => preferred.some(mapping => mapping.providerId === provider.id && installation.manualNoteProductIds?.includes(mapping.retailerProductId))).map(installation => installation.name));
  if (noteAccounts.length) flags.push({ key: 'text', tone: '', icon: 'text', text: `Text item for ${noteAccounts.join(', ')}` });
  const waiting = providers.flatMap(provider => provider.installations.flatMap(installation => (installation.listReplacementBlocks ?? []).filter(block => preferred.some(mapping => mapping.providerId === provider.id && mapping.retailerProductId === block.retailerProductId)).map(block => block.blockingProductName)));
  if (waiting.length) flags.push({ key: 'waiting', tone: 'warn', icon: 'clock', text: `Waiting for ${waiting[0]} to leave the list` });
  const alternatives = resolved.reduce((count, entry) => count + entry.alternatives.length, 0);
  if (alternatives) flags.push({ key: 'alt', tone: '', icon: 'swap', text: `${alternatives} alternative${alternatives === 1 ? '' : 's'}` });
  if (!flags.length) return null;
  return (
    <span className="row-flags">
      {flags.map(flag => <span key={flag.key} className={`flag ${flag.tone}`}>{flag.icon === 'clock' ? <Clock aria-hidden="true" /> : flag.icon === 'text' ? <UtensilsCrossed aria-hidden="true" /> : flag.icon === 'swap' ? <RefreshCw aria-hidden="true" /> : <Clock aria-hidden="true" />}<span>{flag.text}</span></span>)}
    </span>
  );
}

export function ProductQueue({ inventory, catalog, providers, overview: _overview, tab, onTab, query, onQuery, source, onSource, status, onStatus, selectedKey, onSelect, error, loading, onRefresh, pageWindow, onOffset, onPageSize }: {
  inventory: Inventory | null;
  catalog: CatalogData;
  providers: Provider[];
  overview: ShopOverview;
  tab: QueueTab;
  onTab: (tab: QueueTab) => void;
  query: string;
  onQuery: (value: string) => void;
  source: ProductSource;
  onSource: (value: ProductSource) => void;
  status: StatusFilter;
  onStatus: (value: StatusFilter) => void;
  selectedKey: string | null;
  onSelect: (target: InventoryTarget) => void;
  error: string;
  loading: boolean;
  onRefresh: () => void;
  pageWindow: PageWindow<TargetOption>;
  onOffset: (offset: number) => void;
  onPageSize: (size: number) => void;
}) {
  const counts = inventory?.counts;
  const total = counts?.all ?? 0;
  const mapped = counts?.mapped ?? 0;
  const percent = total ? Math.round(mapped / total * 100) : 0;
  const tabs: Array<[QueueTab, string, number]> = [['todo', 'To map', counts?.unmapped ?? 0], ['mapped', 'Mapped', mapped], ['attention', 'Needs attention', counts?.attention ?? 0]];
  const rows = inventory?.targets ?? [];
  const allMapped = tab === 'todo' && Boolean(inventory) && (counts?.unmapped ?? 0) === 0;
  return (
    <section className="queue" aria-label="Own product work queue">
      <div className="queue-heading">
        <div className="queue-progress">
          <div className="ring-container" aria-hidden="true">
            <svg className="progress-ring" viewBox="0 0 40 40"><circle className="track" cx="20" cy="20" r="16" pathLength="100" /><circle className="value" cx="20" cy="20" r="16" pathLength="100" style={{ strokeDashoffset: 100 - percent }} /></svg>
            <span className="ring-number">{percent}%</span>
          </div>
          <div><h2>Your products</h2><p>{mapped} of {total} products mapped</p></div>
        </div>
        <DButton variant="ghost" onClick={onRefresh} disabled={loading} aria-label="Refresh products"><RefreshCw className="size-3.5" /></DButton>
      </div>
      <div className="tabs" role="tablist" aria-label="Mapping status">
        {tabs.map(([id, title, count]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`tab${tab === id ? ' active' : ''}`} onClick={() => onTab(id)}>
            {title} <span className="count">{count}</span>
          </button>
        ))}
      </div>
      <div className="queue-filters">
        <div className="search">
          <Search aria-hidden="true" />
          <input aria-label="Search own products" placeholder="Find a product..." value={query} onChange={event => onQuery(event.target.value)} />
        </div>
        <div className="filter-row">
          <ThemedSelect ariaLabel="Product source" value={source} onChange={onSource} className="w-full" options={[
            { value: 'all', label: 'All sources' }, { value: 'grocy_mealie', label: `Grocy + Mealie${counts ? ` (${counts.grocy_mealie})` : ''}` },
            { value: 'grocy', label: `Grocy only${counts ? ` (${counts.grocy})` : ''}` }, { value: 'mealie', label: `Mealie only${counts ? ` (${counts.mealie})` : ''}` },
          ]} />
          <ThemedSelect ariaLabel="Filter by attention status" value={status} onChange={onStatus} className="w-full" options={[
            { value: 'all', label: 'All statuses' }, { value: 'unit_changed', label: 'Unit changed' }, { value: 'unconfirmed', label: 'Unconfirmed amount' }, { value: 'discontinued', label: 'Discontinued' },
          ]} />
        </div>
      </div>
      {error ? <p className="queue-note" role="alert">{error}</p> : null}
      <div className="list-label"><span>{pageWindow.total} PRODUCT{pageWindow.total === 1 ? '' : 'S'}</span><span>SHOPS MAPPED</span></div>
      <div>
        {loading && !inventory ? <p className="queue-note" role="status">Loading products…</p> : null}
        {inventory && rows.length === 0 ? (
          <EmptyState tone={allMapped ? 'good' : ''} title={allMapped ? 'All products mapped' : 'No matching products'}>
            {allMapped ? 'Every product has a retailer mapping. The next sync will project packages straight onto the shared lists.' : 'Try a different search term, source or status filter.'}
          </EmptyState>
        ) : null}
        {rows.map(target => {
          const reason = target.attention[0];
          return (
            <button key={targetKey(target)} type="button" className={`product-row${selectedKey === targetKey(target) ? ' selected' : ''}`} aria-pressed={selectedKey === targetKey(target)} onClick={() => onSelect(target)} data-testid="shop-own-product">
              <span className="product-symbol"><RowIcon target={target} /></span>
              <span className="product-copy">
                <strong>{target.name}</strong>
                <SourceBadge target={target} />
                {reason ? <><br /><Badge tone={ATTENTION_BADGE[reason].tone}>{ATTENTION_BADGE[reason].label}</Badge></> : null}
                <RowFlags target={target} catalog={catalog} providers={providers} />
              </span>
              <span className="row-tail">{target.mappedProviders.length}/{providers.length} <ChevronRight aria-hidden="true" /></span>
            </button>
          );
        })}
      </div>
      <div style={{ padding: '4px 16px 12px' }}><Pagination themedPageSize window={pageWindow} onOffsetChange={onOffset} onPageSizeChange={onPageSize} disabled={loading} itemLabel="own products" /></div>
      <div className="queue-note"><Link2 aria-hidden="true" /> Linked products share one mapping across Grocy and Mealie.</div>
    </section>
  );
}


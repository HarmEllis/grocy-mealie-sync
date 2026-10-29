'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronRight, Link2, Package, RefreshCw, Sparkles, UtensilsCrossed, X } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DEFAULT_PAGE_SIZE, type PageWindow } from '@/components/mapping-wizard/paging';
import type { ShopOverview } from '@/lib/shop/overview';
import type { InventoryTarget, ProductSource } from '@/lib/shop/product-inventory';
import type { TargetOption } from '@/lib/shop/targets';
import { apiJson } from '../api';
import type { ShopProduct } from '../catalog-options';
import { DButton, EmptyState, Panel, PluginChip, RowItem, RowList, Spinner } from '../shop-ui';
import { ProductDetail } from './ProductDetail';
import { ProductQueue, targetKey } from './ProductQueue';
import { queueFilters, type CatalogData, type Draft, type Inventory, type Mapping, type Provider, type QueueTab, type Suggestion, type StatusFilter } from './types';

const BULK_THRESHOLD_PERCENT = 85;

/**
 * Own products work queue: suggestions inbox, ingredients waiting for a catalogue match, and the
 * queue with its detail pane. Server pagination keeps the queue small; the selected product is held
 * as a full target so its detail still renders when it is not on the current page.
 */
export function ProductsTab({ overview, reloadOverview, initialQuery = '', goToPausedLines }: {
  overview: ShopOverview;
  reloadOverview: () => Promise<void>;
  initialQuery?: string;
  goToPausedLines: () => void;
}) {
  const providers = useMemo<Provider[]>(() => [...new Set(overview.installations.map(installation => installation.providerId).filter((id): id is string => Boolean(id)))].map(id => {
    const installations = overview.installations.filter(installation => installation.providerId === id);
    return { id, name: installations[0].providerLabel ?? installations[0].name, installationId: installations.find(installation => installation.connected)?.id ?? null, installations };
  }), [overview]);
  const [catalog, setCatalog] = useState<CatalogData>({ mappings: [], products: [], suggestions: [] });
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [tab, setTab] = useState<QueueTab>('todo');
  const [query, setQuery] = useState(initialQuery);
  const [source, setSource] = useState<ProductSource>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<(TargetOption & { attention?: InventoryTarget['attention'] }) | null>(null);
  const [pendingDraft, setPendingDraft] = useState<Draft | undefined>(undefined);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(true);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const sequence = useRef(0);
  const focusAfterLoad = useRef<string | null>(null);

  const mergeProducts = useCallback((products: ShopProduct[]) => setCatalog(current => {
    const merged = new Map(current.products.map(product => [`${product.providerId}:${product.externalId}`, product]));
    for (const product of products) merged.set(`${product.providerId}:${product.externalId}`, product);
    return { ...current, products: [...merged.values()] };
  }), []);
  const loadCatalog = useCallback(async () => { if (providers.length) setCatalog(await apiJson<CatalogData>('/api/shop/mappings')); }, [providers.length]);

  const { mapped: mappedParam, attention: attentionParam } = queueFilters(tab, status);
  const inventoryQueryKey = JSON.stringify([query, source, mappedParam, attentionParam, offset, pageSize, providers.length]);
  const activeInventoryQuery = useRef(inventoryQueryKey);
  activeInventoryQuery.current = inventoryQueryKey;
  const loadInventory = useCallback(async (refresh = false) => {
    // A save finishing after a filter change must not start a read for its old filter.
    if (!providers.length || activeInventoryQuery.current !== inventoryQueryKey) return;
    const request = ++sequence.current;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ query, source, mapped: mappedParam, offset: String(offset), limit: String(pageSize), ...(attentionParam ? { attention: attentionParam } : {}), ...(refresh ? { refresh: '1' } : {}) });
      const data = await apiJson<Inventory>(`/api/shop/products?${params}`);
      if (request !== sequence.current || activeInventoryQuery.current !== inventoryQueryKey) return;
      if (offset > 0 && offset >= data.total) { setOffset(Math.max(0, Math.floor((data.total - 1) / pageSize) * pageSize)); return; }
      setInventory(data);
    } catch (err) { if (request === sequence.current) setError((err as Error).message); }
    finally { if (request === sequence.current) setLoading(false); }
  }, [query, source, mappedParam, attentionParam, offset, pageSize, providers.length, inventoryQueryKey]);
  useEffect(() => { const timer = window.setTimeout(() => void loadInventory(), 250); return () => { window.clearTimeout(timer); sequence.current++; }; }, [loadInventory]);
  useEffect(() => { void loadCatalog().catch(err => toast.error('Could not load retailer mappings', { description: err.message })); const timer = window.setInterval(() => void loadCatalog().catch(() => {}), 30_000); return () => window.clearInterval(timer); }, [loadCatalog]);
  useEffect(() => { const timer = window.setInterval(() => void loadInventory(), 30_000); return () => window.clearInterval(timer); }, [loadInventory]);
  const reload = useCallback(async () => { await Promise.all([loadCatalog(), loadInventory(true), reloadOverview()]); }, [loadCatalog, loadInventory, reloadOverview]);

  const rows = inventory?.targets ?? [];
  const narrow = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 650px)').matches;

  // Select the first product on wide screens, honour a product another part of the page asked for, and keep
  // the attention reasons of the selection current when the list reloads.
  useEffect(() => {
    if (!inventory) return;
    const wanted = focusAfterLoad.current;
    const match = wanted ? rows.find(row => targetKey(row) === wanted) : undefined;
    if (match) { focusAfterLoad.current = null; setSelected(match); return; }
    setSelected(current => {
      if (current) return rows.find(row => targetKey(row) === targetKey(current)) ?? current;
      return narrow() ? null : rows[0] ?? null;
    });
  }, [inventory, rows]);

  function select(target: TargetOption & { attention?: InventoryTarget['attention'] }, draft?: Draft) {
    setSelected(target);
    setPendingDraft(draft);
    if (narrow()) { setSheetOpen(true); document.body.style.overflow = 'hidden'; }
  }
  function closeSheet() { setSheetOpen(false); document.body.style.overflow = ''; }
  useEffect(() => () => { document.body.style.overflow = ''; }, []);

  const selectedIndex = selected ? rows.findIndex(row => targetKey(row) === targetKey(selected)) : -1;
  function move(direction: 1 | -1) {
    if (!rows.length) return;
    const next = rows[Math.min(rows.length - 1, Math.max(0, (selectedIndex < 0 ? (direction === 1 ? -1 : rows.length) : selectedIndex) + direction))];
    setSelected(next); setPendingDraft(undefined);
  }
  function advance() {
    if (selectedIndex >= 0 && selectedIndex < rows.length - 1) { setSelected(rows[selectedIndex + 1]); setPendingDraft(undefined); }
    else if (narrow()) closeSheet();
  }

  // Queue keyboard: up/down and J/K move the selection, Escape closes the mobile sheet.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement | null;
      if (element?.closest('input, select, textarea, [role="combobox"], [role="listbox"], [role="dialog"], details')) return;
      if (event.key === 'Escape' && sheetOpen) { closeSheet(); return; }
      const down = event.key === 'ArrowDown' || event.key === 'j';
      const up = event.key === 'ArrowUp' || event.key === 'k';
      if (!down && !up) return;
      event.preventDefault();
      move(down ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function decide(suggestion: Suggestion, action: 'accept' | 'reject') {
    try {
      const result = await apiJson<{ mapping?: Mapping }>(`/api/shop/suggestions/${suggestion.id}`, { method: 'POST', body: JSON.stringify({ action }) });
      if (action === 'accept' && result.mapping) {
        const mapping = result.mapping;
        const product = catalog.products.find(candidate => candidate.providerId === mapping.providerId && candidate.externalId === mapping.retailerProductId);
        const target: TargetOption = {
          kind: mapping.targetKind as TargetOption['kind'], id: mapping.targetId, name: mapping.targetName,
          baseUnitId: mapping.targetKind === 'grocy_product' ? mapping.packageBaseUnitId : null,
          baseUnitName: mapping.targetKind === 'grocy_product' ? mapping.packageBaseUnitName : null,
        };
        if (product) select(target, { providerId: mapping.providerId, product, role: mapping.role === 'alternative' ? 'alternative' : 'preferred', mapping });
      }
      toast.success(action === 'accept' ? 'Mapping saved; check its unit and package amount' : 'Suggestion rejected');
      await reload();
    } catch (err) { toast.error((err as Error).message); }
  }

  const confident = catalog.suggestions.filter(suggestion => Math.round(suggestion.score * 100) > BULK_THRESHOLD_PERCENT);
  async function acceptConfident() {
    setBulkRunning(true);
    try {
      const result = await apiJson<{ accepted: unknown[]; skipped: Array<{ reason: string }> }>('/api/shop/suggestions/bulk', { method: 'POST', body: JSON.stringify({ minScore: BULK_THRESHOLD_PERCENT / 100 }) });
      toast.success(`${result.accepted.length} suggestion(s) accepted`, { description: result.skipped.length ? `${result.skipped.length} skipped: ${[...new Set(result.skipped.map(item => item.reason))].slice(0, 2).join(' · ')}` : 'Their package amounts are still unconfirmed and appear under Needs attention.' });
      setConfirmBulk(false);
      await reload();
    } catch (err) { toast.error('Could not accept the suggestions', { description: (err as Error).message }); }
    finally { setBulkRunning(false); }
  }

  const pageWindow: PageWindow<TargetOption> = { rows, total: inventory?.total ?? 0, offset, pageSize, page: Math.floor(offset / pageSize) + 1, pageCount: Math.max(1, Math.ceil((inventory?.total ?? 0) / pageSize)), hasPrevious: offset > 0, hasNext: offset + pageSize < (inventory?.total ?? 0) };
  const suggestions = showAllSuggestions ? catalog.suggestions : catalog.suggestions.slice(0, 5);
  const searches = catalog.searches ?? [];

  function resetPaging<T>(setter: (value: T) => void) { return (value: T) => { setter(value); setOffset(0); }; }
  function reviewResults(search: NonNullable<CatalogData['searches']>[number]) {
    focusAfterLoad.current = `${search.targetKind}:${search.targetId}`;
    setTab('todo'); setStatus('all'); setSource('all'); setQuery(search.targetName); setOffset(0);
  }

  if (!providers.length) return <p className="text-sm text-muted-foreground">Connect a shop plugin first.</p>;

  return (
    <>
      <section className="inbox" aria-label="Suggested matches" data-testid="suggestions-inbox">
        <div className={`inbox-head${inboxOpen && catalog.suggestions.length ? '' : ' collapsed'}`}>
          <div className="inbox-title"><Sparkles className="size-4" aria-hidden="true" /> Suggestions <span className="count">{catalog.suggestions.length}</span></div>
          <div className="inbox-actions">
            {catalog.suggestions.length > 5 ? <DButton variant="ghost" onClick={() => setShowAllSuggestions(value => !value)}>{showAllSuggestions ? 'Show 5' : `Show all ${catalog.suggestions.length}`}</DButton> : null}
            <DButton variant="ghost" disabled={confident.length === 0 || bulkRunning} onClick={() => setConfirmBulk(true)} data-testid="accept-high-confidence"><Check className="size-3.5" /> Accept all above {BULK_THRESHOLD_PERCENT}%</DButton>
            <button type="button" className="icon-button" onClick={() => setInboxOpen(value => !value)} aria-label={`${inboxOpen ? 'Collapse' : 'Expand'} suggestions`} aria-expanded={inboxOpen}>{inboxOpen ? <X aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}</button>
          </div>
        </div>
        {inboxOpen ? (catalog.suggestions.length ? (
          <div className="suggestions">
            {suggestions.map(suggestion => {
              const product = catalog.products.find(candidate => candidate.providerId === suggestion.providerId && candidate.externalId === suggestion.retailerProductId);
              const provider = providers.find(candidate => candidate.id === suggestion.providerId);
              return (
                <article key={suggestion.id} className="suggestion" data-testid="suggestion">
                  <div className="suggestion-top"><strong>{suggestion.targetName}</strong><span className="score">{Math.round(suggestion.score * 100)}%</span></div>
                  <p>{product?.name ?? suggestion.retailerProductId}{product?.packageAmount ? ` · ${product.packageAmount} ${product.packageUnit ?? ''}` : ''}</p>
                  <div className="suggestion-bottom">
                    <span className="small muted">{provider?.name ?? suggestion.providerId}</span>
                    <div>
                      <button type="button" className="accept" onClick={() => void decide(suggestion, 'accept')} aria-label={`Accept the ${suggestion.targetName} suggestion for ${provider?.name ?? suggestion.providerId}`}><Check aria-hidden="true" /> Accept</button>
                      <button type="button" className="icon-button" onClick={() => void decide(suggestion, 'reject')} aria-label={`Reject the ${suggestion.targetName} suggestion for ${provider?.name ?? suggestion.providerId}`}><X aria-hidden="true" /></button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : <p className="inbox-empty">No open suggestions. New catalogue matches appear here with their score.</p>) : null}
      </section>

      <Panel
        testId="ingredients-panel"
        icon={<UtensilsCrossed className="size-4" />}
        title="Shopping ingredients to map"
        subtitle="Ingredients that arrived from Mealie without a retailer product. gm-sync searches the catalogue and retries a failed search with a growing delay, up to an hour. Search again asks for an earlier retry."
        className="my-[18px]"
      >
        {searches.length === 0 ? <EmptyState tone="good" title="Every shopping ingredient is mapped">Ingredients that reach the shopping list without a retailer product show up here with their catalogue search status.</EmptyState> : (
          <RowList>
            {searches.map(search => (
              <RowItem
                key={search.id}
                testId="ingredient-search"
                actions={<>
                  <DButton variant="ghost" disabled={search.status === 'pending'} onClick={async () => { try { await apiJson(`/api/shop/searches/${search.id}/retry`, { method: 'POST', body: '{}' }); await loadCatalog(); } catch (err) { toast.error((err as Error).message); } }}><RefreshCw className="size-3.5" /> Search again</DButton>
                  {search.status !== 'pending' && !search.lastError && search.resultCount > 0 ? <DButton variant="ghost" onClick={() => reviewResults(search)}><ArrowRight className="size-3.5" /> Review results</DButton> : null}
                </>}
              >
                <strong>{search.targetName}</strong>
                <div className="row-sub"><PluginChip name={providers.find(provider => provider.id === search.providerId)?.name ?? search.providerId} /></div>
                {search.status === 'pending' ? <span className="ing-status"><Spinner />Waiting for catalogue search…</span>
                  : search.lastError ? <><span className="ing-status bad">Catalogue search failed</span><p className="row-hint">{search.lastError}</p></>
                    : <span className={`ing-status${search.resultCount ? ' ok' : ''}`}>{search.resultCount ? <Check aria-hidden="true" /> : null}Found {search.resultCount} products</span>}
              </RowItem>
            ))}
          </RowList>
        )}
      </Panel>

      <div className="workspace" data-testid="mapping-workspace">
        <ProductQueue
          inventory={inventory} catalog={catalog} providers={providers} overview={overview}
          tab={tab} onTab={resetPaging(setTab)} query={query} onQuery={resetPaging(setQuery)} source={source} onSource={resetPaging(setSource)} status={status} onStatus={resetPaging(setStatus)}
          selectedKey={selected ? targetKey(selected) : null} onSelect={target => select(target)}
          error={error} loading={loading} onRefresh={() => void reload().catch(err => toast.error(err.message))}
          pageWindow={pageWindow} onOffset={setOffset} onPageSize={size => { setPageSize(size); setOffset(0); }}
        />
        <section className={`detail${sheetOpen ? ' sheet-open' : ''}`} aria-label="Product mapping detail" data-testid="product-detail">
          {selected ? (
            <ProductDetail
              key={targetKey(selected)}
              target={selected}
              attention={selected.attention ?? []}
              providers={providers} catalog={catalog} units={inventory?.mealieUnits ?? []} lines={overview.lines}
              initialDraft={pendingDraft}
              onCatalog={mergeProducts} reload={reload}
              onPrev={() => move(-1)} onNext={() => move(1)} onBack={closeSheet} onAdvance={advance} goToPausedLines={goToPausedLines}
            />
          ) : (
            <div className="detail-empty">
              <EmptyState tone={inventory && (inventory.counts.unmapped === 0) ? 'good' : ''} title={inventory && inventory.counts.unmapped === 0 ? 'All products mapped' : 'Pick a product to map'}>
                {inventory && inventory.counts.unmapped === 0 ? 'Every product has a retailer match, so the next sync can project packages without guesswork.' : 'Select a product on the left to review its retailer matches, package amount and conversion.'}
              </EmptyState>
            </div>
          )}
        </section>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="legend" data-testid="target-legend">
          <span><b>Mapping target</b></span>
          <span><Link2 aria-hidden="true" /><b>G + M</b> linked, recommended</span>
          <span><Package aria-hidden="true" /><b>G</b> Grocy only</span>
          <span><UtensilsCrossed aria-hidden="true" /><b>M</b> Mealie only</span>
          <span className="muted">A linked target keeps one amount for stock and recipes. Only the preferred product goes to the list; alternatives help recognize purchases.</span>
          {overview.installations.some(installation => !installation.providerId) ? <span className="muted">A plugin without a catalogue yet cannot be mapped.</span> : null}
        </div>
      </div>
      <div className="keyboard-hints">
        <span><kbd>↑</kbd><kbd>↓</kbd> or <kbd>J</kbd><kbd>K</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Confirm &amp; next</span>
        <span><kbd>Esc</kbd> Close panel</span>
      </div>

      <ConfirmDialog
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        onConfirm={() => void acceptConfident()}
        running={bulkRunning}
        title={`Accept ${confident.length} suggestion${confident.length === 1 ? '' : 's'} above ${BULK_THRESHOLD_PERCENT}%?`}
        description="The mappings are saved without a confirmed package amount, so they appear under Needs attention until you check each amount. Suggestions that conflict with an existing mapping are skipped and reported."
        itemNames={confident.slice(0, 10).map(suggestion => `${suggestion.targetName} (${Math.round(suggestion.score * 100)}%)`)}
      />
    </>
  );
}


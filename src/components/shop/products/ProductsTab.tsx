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
import { forTarget, queueFilters, type CatalogData, type Draft, type Inventory, type Mapping, type Provider, type QueueTab, type Suggestion, type StatusFilter } from './types';

const BULK_THRESHOLD_PERCENT = 85;

/**
 * Own products work queue: suggestions inbox, ingredients waiting for a catalogue match, and the
 * queue with its detail pane. Server pagination keeps the queue small; the selected product is held
 * as a full target so its detail still renders when it is not on the current page.
 */
export function ProductsTab({ overview, reloadOverview, initialQuery = '', initialTab = 'todo', goToPausedLines }: {
  overview: ShopOverview;
  reloadOverview: () => Promise<void>;
  initialQuery?: string;
  initialTab?: QueueTab;
  goToPausedLines: () => void;
}) {
  const providers = useMemo<Provider[]>(() => [...new Set(overview.installations.map(installation => installation.providerId).filter((id): id is string => Boolean(id)))].map(id => {
    const installations = overview.installations.filter(installation => installation.providerId === id);
    return { id, name: installations[0].providerLabel ?? installations[0].name, installationId: installations.find(installation => installation.connected)?.id ?? null, installations };
  }), [overview]);
  const [catalog, setCatalog] = useState<CatalogData>({ mappings: [], products: [], suggestions: [] });
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [tab, setTab] = useState<QueueTab>(initialTab);
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
  // Mirrors of state that async handlers read: updated at the moment of change, not at the next render, so a
  // handler that resumes right after a reload sees the new list.
  const rowsRef = useRef<InventoryTarget[]>([]);
  const selectedRef = useRef<(TargetOption & { attention?: InventoryTarget['attention'] }) | null>(null);

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
      rowsRef.current = data.targets;
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
  // Where the selection last sat in the list, so Confirm & next can land on the neighbour even after the
  // saved product left the current filter (To map and Needs attention shrink when a mapping is confirmed).
  const lastIndex = useRef(0);

  /** The inventory row for a target (source, linked foods, attention), wherever it sits in the list. */
  const resolveTarget = useCallback(async (kind: string, id: string, name: string): Promise<(TargetOption & { attention?: InventoryTarget['attention'] }) | null> => {
    try {
      const data = await apiJson<Inventory>(`/api/shop/products?${new URLSearchParams({ query: name.slice(0, 200), mapped: 'all', limit: '200' })}`);
      return data.targets.find(target => target.kind === kind && target.id === id) ?? null;
    } catch { return null; }
  }, []);

  // Select the first product on wide screens and keep the selection's data current when the list reloads. A
  // selection that left the current filter is fetched again, so its attention reasons are never stale.
  useEffect(() => {
    if (!inventory) return;
    const current = selectedRef.current;
    if (!current) { const first = narrow() ? null : rows[0] ?? null; selectedRef.current = first; setSelected(first); return; }
    const index = rows.findIndex(row => targetKey(row) === targetKey(current));
    if (index >= 0) { lastIndex.current = index; selectedRef.current = rows[index]; setSelected(rows[index]); return; }
    let cancelled = false;
    void resolveTarget(current.kind, current.id, current.name).then(fresh => {
      // Only refresh a selection that is still the one this lookup was for.
      if (!cancelled && fresh && selectedRef.current && targetKey(selectedRef.current) === targetKey(current)) { selectedRef.current = fresh; setSelected(fresh); }
    });
    return () => { cancelled = true; };
  }, [inventory, rows, resolveTarget]);

  function select(target: TargetOption & { attention?: InventoryTarget['attention'] }, draft?: Draft) {
    selectedRef.current = target;
    setSelected(target);
    setPendingDraft(draft);
    const index = rowsRef.current.findIndex(row => targetKey(row) === targetKey(target));
    if (index >= 0) lastIndex.current = index;
    if (narrow()) { setSheetOpen(true); document.body.style.overflow = 'hidden'; }
  }
  function closeSheet() { setSheetOpen(false); document.body.style.overflow = ''; }
  useEffect(() => () => { document.body.style.overflow = ''; }, []);

  function move(direction: 1 | -1) {
    const list = rowsRef.current;
    if (!list.length) return;
    const current = selectedRef.current;
    const index = current ? list.findIndex(row => targetKey(row) === targetKey(current)) : -1;
    const next = list[Math.min(list.length - 1, Math.max(0, (index < 0 ? (direction === 1 ? -1 : list.length) : index) + direction))];
    selectedRef.current = next;
    setSelected(next); setPendingDraft(undefined);
  }
  /** Confirm & next: the neighbour in the current list, whether the saved product is still listed or left the filter. */
  function advance() {
    const list = rowsRef.current;
    const current = selectedRef.current;
    const index = current ? list.findIndex(row => targetKey(row) === targetKey(current)) : -1;
    // Still listed: the neighbour below (none at the end of the list). Gone from the filter: whoever took its place.
    const next = index >= 0 ? list[index + 1] : list[Math.min(lastIndex.current, list.length - 1)];
    if (next) { selectedRef.current = next; setSelected(next); setPendingDraft(undefined); }
    else if (narrow()) closeSheet();
  }

  // Queue keyboard (bound once; the handler always sees the latest state through refs and these functions).
  const keyHandler = useRef<(event: KeyboardEvent) => void>(() => {});
  keyHandler.current = event => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
    const element = event.target as HTMLElement | null;
    if (element?.closest('input, select, textarea, [role="combobox"], [role="listbox"], details')) return;
    if (event.key === 'Escape' && sheetOpen) { closeSheet(); return; }
    if (sheetOpen) return;
    const down = event.key === 'ArrowDown' || event.key === 'j';
    const up = event.key === 'ArrowUp' || event.key === 'k';
    if (!down && !up) return;
    event.preventDefault();
    move(down ? 1 : -1);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => keyHandler.current(event);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function decide(suggestion: Suggestion, action: 'accept' | 'reject') {
    try {
      const result = await apiJson<{ mapping?: Mapping }>(`/api/shop/suggestions/${suggestion.id}`, { method: 'POST', body: JSON.stringify({ action }) });
      if (action === 'accept' && result.mapping) {
        const mapping = result.mapping;
        const product = catalog.products.find(candidate => candidate.providerId === mapping.providerId && candidate.externalId === mapping.retailerProductId);
        // Prefer the full inventory row (source, linked foods, attention); the mapping only knows its own target.
        const target = await resolveTarget(mapping.targetKind, mapping.targetId, mapping.targetName) ?? {
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
  /** Show a product from the ingredients panel: put the queue on a view that lists it and open its detail. */
  async function reviewResults(search: NonNullable<CatalogData['searches']>[number]) {
    const target = await resolveTarget(search.targetKind, search.targetId, search.targetName);
    if (!target) { toast.error('That product is no longer in the list'); return; }
    const hasPreferred = catalog.mappings.some(mapping => mapping.role === 'preferred' && forTarget(mapping, target));
    setTab(hasPreferred ? 'mapped' : 'todo'); setStatus('all'); setSource('all'); setQuery(search.targetName); setOffset(0);
    select(target);
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
                  {search.status !== 'pending' && !search.lastError && search.resultCount > 0 ? <DButton variant="ghost" onClick={() => void reviewResults(search)}><ArrowRight className="size-3.5" /> Review results</DButton> : null}
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
        variant="default"
        title={`Accept ${confident.length} suggestion${confident.length === 1 ? '' : 's'} above ${BULK_THRESHOLD_PERCENT}%?`}
        description="The mappings are saved without a confirmed package amount, so they appear under Needs attention until you check each amount. Suggestions that conflict with an existing mapping are skipped and reported."
        itemNames={confident.slice(0, 10).map(suggestion => `${suggestion.targetName} (${Math.round(suggestion.score * 100)}%)`)}
      />
    </>
  );
}


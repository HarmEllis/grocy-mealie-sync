'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Loader2, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AppBadge, AppInput, ProgressRing } from '@/components/redesign/primitives';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { ThemedSelect } from '@/components/shared/ThemedSelect';
import { Pagination } from '@/components/mapping-wizard/Pagination';
import { DEFAULT_PAGE_SIZE, type PageWindow } from '@/components/mapping-wizard/paging';
import type { ShopOverview } from '@/lib/shop/overview';
import type { TargetOption } from '@/lib/shop/targets';
import type { productInventory, ProductSource } from '@/lib/shop/product-inventory';
import type { mappingPreview } from '@/lib/shop/mapping-preview';
import { apiJson } from './api';
import { catalogOptions, productLabel, type ShopProduct } from './catalog-options';

interface Mapping {
  id: string; providerId: string; retailerProductId: string; retailerProductName: string;
  targetKind: string; targetId: string; targetName: string; role: string;
  packageBaseAmount: number | null; packageBaseUnitId: string | null; packageBaseUnitName: string | null;
  confirmed: boolean;
}
interface Suggestion { id: string; providerId: string; retailerProductId: string; targetKind: string; targetId: string; targetName: string; score: number }
interface SearchStatus { id: string; targetName: string; status: string; resultCount: number; lastError: string | null }
interface CatalogData { mappings: Mapping[]; products: ShopProduct[]; suggestions: Suggestion[]; searches?: SearchStatus[] }
type Inventory = Awaited<ReturnType<typeof productInventory>>;
type Provider = { id: string; name: string; installationId: string | null; installations: ShopOverview['installations'] };
type Draft = { providerId: string; product: ShopProduct; role: 'preferred' | 'alternative'; mapping?: Mapping; replaces?: Mapping };

function canChooseProduct(catalog: CatalogData, providerId: string, product: ShopProduct, target: TargetOption, role: 'preferred' | 'alternative', currentId?: string) {
  const existing = catalog.mappings.find(mapping => mapping.providerId === providerId && mapping.retailerProductId === product.externalId);
  if (existing && !forTarget(existing, target)) { toast.error(`Already mapped to ${existing.targetName}`, { description: 'Remove that mapping first to move this product.' }); return false; }
  if (role === 'alternative' && existing && existing.id !== currentId) { toast.error('This product is already linked to this ingredient.'); return false; }
  return true;
}

function sourceLabel(target: TargetOption) { return target.source === 'grocy_mealie' ? 'G+M' : target.kind === 'grocy_product' ? 'G' : 'M'; }
function forTarget(mapping: { targetKind: string; targetId: string }, target: TargetOption) { return (mapping.targetKind === target.kind && mapping.targetId === target.id) || (target.kind === 'grocy_product' && mapping.targetKind === 'mealie_food' && Boolean(target.linkedFoods?.some(food => food.id === mapping.targetId))); }
function conversionLabel(mapping: Mapping, product?: ShopProduct) {
  return `1 ${product?.measure === 'weight' ? 'kg' : 'package'} = ${mapping.packageBaseAmount ?? '?'} ${mapping.packageBaseUnitName ?? 'items'}`;
}

/** A closed row never calls the plugin. Known products are shown immediately on opening. */
function RetailerSelect({ provider, products, target, value, selectedName, suggestions, onChoose, onCatalog }: {
  provider: Provider; products: ShopProduct[]; target: TargetOption; value: string | null; selectedName?: string;
  suggestions: Suggestion[]; onChoose: (product: ShopProduct | null) => void; onCatalog: (products: ShopProduct[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<ShopProduct[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const requestSequence = useRef(0);
  const suggestedIds = useMemo(() => new Set(suggestions.filter(suggestion => suggestion.providerId === provider.id && forTarget(suggestion, target)).map(suggestion => suggestion.retailerProductId)), [suggestions, provider.id, target]);
  const options = useMemo(() => {
    if (!open) return [];
    const merged = new Map(catalogOptions(products, provider.id, query, suggestedIds).map(option => [option.value, option]));
    for (const product of remote) if (product.availability !== 'discontinued') merged.set(product.externalId, { value: product.externalId, label: productLabel(product) });
    return [...merged.values()];
  }, [products, provider.id, query, suggestedIds, remote, open]);
  const selected = products.find(product => product.providerId === provider.id && product.externalId === value);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    setError('');
    setLoading(false);
    setRemote([]);
    if (!open || !provider.installationId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      // Suggest retailer matches for the own ingredient without prefilling or filtering the input.
      const search = query.trim() || target.name;
      void apiJson<{ status?: string; message?: string; products: Array<{ id: string; name: string; packageAmount?: number; packageUnit?: string; measure: string; availability?: string; availabilityCheckedAt?: string }> }>(`/api/plugins/installations/${provider.installationId}/catalog?query=${encodeURIComponent(search.slice(0, 200))}${retry ? '&refresh=1' : ''}`, { signal: controller.signal }).then(result => {
        if (sequence !== requestSequence.current) return;
        if (result.status === 'offline') setError(result.message ?? 'Live search unavailable.');
        const found = result.products.map(product => ({ ...product, providerId: provider.id, externalId: product.id, packageAmount: product.packageAmount ?? null, packageUnit: product.packageUnit ?? null }));
        setRemote(found);
        onCatalog(found);
      }).catch(err => { if (sequence === requestSequence.current && !controller.signal.aborted) setError((err as Error).message); })
        .finally(() => { if (sequence === requestSequence.current) setLoading(false); });
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); requestSequence.current++; };
  }, [open, query, provider.id, provider.installationId, target.name, retry, onCatalog]);

  return <div className="min-w-0 space-y-1">
    <SearchableSelect className="w-full min-w-0" controlClassName="min-h-10 md:min-h-8" ariaLabel={`${provider.name} product for ${target.name}`} placeholder={`Search ${provider.name}…`}
      clearable={false} value={value} options={options} extraOption={value ? { value, label: selected ? productLabel(selected) : selectedName ?? value } : null}
      onSearchChange={setQuery} onOpenChange={next => { setOpen(next); if (!next) setQuery(''); }}
      onChange={id => { if (!id) onChoose(null); else { const product = products.find(candidate => candidate.providerId === provider.id && candidate.externalId === id); if (product && product.availability !== 'discontinued') onChoose(product); } }} />
    {open && !provider.installationId ? <p className="text-xs text-muted-foreground">Plugin offline · known products only</p> : null}
    {selected?.availabilityCheckedAt ? <span className="text-[10px] text-muted-foreground" title="Last availability check reported by the retailer">Checked {new Date(selected.availabilityCheckedAt).toLocaleString()}</span> : null}
    {loading ? <p className="flex items-center gap-1 text-xs text-muted-foreground" role="status"><Loader2 className="size-3 animate-spin" /> Searching retailer…</p> : null}
    {error ? <div className="text-xs text-destructive" role="alert">{error} · showing known products <Button size="sm" variant="ghost" onClick={() => setRetry(value => value + 1)}>Retry</Button></div> : null}
  </div>;
}

export function OwnProductsTab({ overview, reloadOverview }: { overview: ShopOverview; reloadOverview: () => Promise<void> }) {
  const providers = useMemo<Provider[]>(() => [...new Set(overview.installations.map(installation => installation.providerId).filter((id): id is string => Boolean(id)))].map(id => {
    const installations = overview.installations.filter(installation => installation.providerId === id);
    return { id, name: installations[0].providerLabel ?? installations[0].name, installationId: installations.find(installation => installation.connected)?.id ?? null, installations };
  }), [overview]);
  const [catalog, setCatalog] = useState<CatalogData>({ mappings: [], products: [], suggestions: [] });
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<ProductSource>('all');
  const [mapped, setMapped] = useState<'all' | 'mapped' | 'unmapped'>('all');
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<{ target: TargetOption; draft?: Draft } | null>(null);
  const [allSuggestions, setAllSuggestions] = useState(false);
  const sequence = useRef(0);

  const mergeProducts = useCallback((products: ShopProduct[]) => setCatalog(current => {
    const merged = new Map(current.products.map(product => [`${product.providerId}:${product.externalId}`, product]));
    for (const product of products) merged.set(`${product.providerId}:${product.externalId}`, product);
    return { ...current, products: [...merged.values()] };
  }), []);
  const loadCatalog = useCallback(async () => { if (providers.length) setCatalog(await apiJson<CatalogData>('/api/shop/mappings')); }, [providers.length]);
  const inventoryQueryKey = JSON.stringify([query, source, mapped, offset, pageSize, providers.length]);
  const activeInventoryQuery = useRef(inventoryQueryKey);
  activeInventoryQuery.current = inventoryQueryKey;
  const loadInventory = useCallback(async (refresh = false) => {
    // A save finishing after a filter change must not start a read for its old filter.
    if (!providers.length || activeInventoryQuery.current !== inventoryQueryKey) return;
    const request = ++sequence.current;
    setLoading(true); setError('');
    try {
      const data = await apiJson<Inventory>(`/api/shop/products?${new URLSearchParams({ query, source, mapped, offset: String(offset), limit: String(pageSize), ...(refresh ? { refresh: '1' } : {}) })}`);
      if (request !== sequence.current || activeInventoryQuery.current !== inventoryQueryKey) return;
      if (offset > 0 && offset >= data.total) { setOffset(Math.max(0, Math.floor((data.total - 1) / pageSize) * pageSize)); return; }
      setInventory(data);
    } catch (err) { if (request === sequence.current) setError((err as Error).message); }
    finally { if (request === sequence.current) setLoading(false); }
  }, [query, source, mapped, offset, pageSize, providers.length, inventoryQueryKey]);
  useEffect(() => { const timer = window.setTimeout(() => void loadInventory(), 250); return () => { window.clearTimeout(timer); sequence.current++; }; }, [loadInventory]);
  useEffect(() => { void loadCatalog().catch(err => toast.error('Could not load retailer mappings', { description: err.message })); const timer = window.setInterval(() => void loadCatalog().catch(() => {}), 30_000); return () => window.clearInterval(timer); }, [loadCatalog]);
  useEffect(() => { const timer = window.setInterval(() => void loadInventory(), 30_000); return () => window.clearInterval(timer); }, [loadInventory]);
  const reload = useCallback(async () => { await Promise.all([loadCatalog(), loadInventory(true), reloadOverview()]); }, [loadCatalog, loadInventory, reloadOverview]);
  async function remove(mapping: Mapping) {
    try { await apiJson(`/api/shop/mappings/${mapping.id}`, { method: 'DELETE' }); await reload(); }
    catch (err) { toast.error('Could not remove mapping', { description: (err as Error).message }); }
  }
  const pageWindow: PageWindow<TargetOption> = { rows: inventory?.targets ?? [], total: inventory?.total ?? 0, offset, pageSize, page: Math.floor(offset / pageSize) + 1, pageCount: Math.max(1, Math.ceil((inventory?.total ?? 0) / pageSize)), hasPrevious: offset > 0, hasNext: offset + pageSize < (inventory?.total ?? 0) };
  if (!providers.length) return <p className="text-sm text-muted-foreground">Connect a shop plugin first.</p>;

  return <div className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <ProgressRing value={inventory?.counts.mapped ?? 0} max={inventory?.counts.all ?? 0} size={44} color="#4ade80" />
      <div><p className="text-xs font-bold text-text-1">Shop product mappings</p><p className="text-xs text-text-3">{inventory?.counts.mapped ?? 0} mapped · {inventory?.counts.unmapped ?? 0} to map</p></div>
      <Button className="ml-auto" variant="outline" size="sm" disabled={loading} onClick={() => void reload().catch(err => toast.error(err.message))}><RefreshCw className="size-3.5" /> Refresh</Button>
    </div>
    <p className="text-xs text-muted-foreground">(G+M) linked Grocy + Mealie, recommended · (G) Grocy only · (M) Mealie only. Only the preferred product goes to the list; alternatives help recognize purchases.</p>
    <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 sm:flex-row">
      <AppInput className="min-w-0 flex-1" placeholder="Search your products or linked ingredients" aria-label="Search own products" value={query} onChange={event => { setQuery(event.target.value); setOffset(0); }} />
      <ThemedSelect className="w-full sm:w-48" ariaLabel="Product source" value={source} onChange={value => { setSource(value); setOffset(0); }} options={[
        { value: 'all', label: `All (${inventory?.counts.all ?? 0})` }, { value: 'grocy_mealie', label: `(G+M) Linked (${inventory?.counts.grocy_mealie ?? 0})` },
        { value: 'grocy', label: `(G) Grocy only (${inventory?.counts.grocy ?? 0})` }, { value: 'mealie', label: `(M) Mealie only (${inventory?.counts.mealie ?? 0})` },
      ]} />
      <ThemedSelect className="w-full sm:w-44" ariaLabel="Mapping status" value={mapped} onChange={value => { setMapped(value); setOffset(0); }} options={[{ value: 'all', label: 'All mappings' }, { value: 'mapped', label: 'Mapped' }, { value: 'unmapped', label: 'Not yet mapped' }]} />
    </div>
    {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    {loading ? <p className="text-xs text-muted-foreground" role="status">Loading products…</p> : null}
    <Table containerClassName="min-w-0 rounded-md border max-md:border-0" className="block md:table [&_tbody]:block md:[&_tbody]:table-row-group [&_tbody>tr]:mb-3 [&_tbody>tr]:block [&_tbody>tr]:rounded-md [&_tbody>tr]:border [&_tbody>tr]:p-3 md:[&_tbody>tr]:mb-0 md:[&_tbody>tr]:table-row md:[&_tbody>tr]:border-0 md:[&_tbody>tr]:border-b md:[&_tbody>tr]:p-0">
      <TableHeader className="hidden bg-muted/30 md:table-header-group"><TableRow><TableHead>Product</TableHead>{providers.map(provider => <TableHead key={provider.id}>{provider.name}</TableHead>)}<TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
      <TableBody>{pageWindow.rows.map(target => <TableRow key={`${target.kind}:${target.id}`} data-testid="shop-own-product">
        <TableCell className="block whitespace-normal md:table-cell"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{target.name}</span><AppBadge small tone={target.source === 'grocy_mealie' ? 'success' : 'default'}>{sourceLabel(target)}</AppBadge><span className="text-xs text-muted-foreground">{target.baseUnitName ?? (target.kind === 'grocy_product' ? 'Stock unit missing' : 'Choose unit')}</span></div>
          {target.linkedFoods?.length ? <p className="mt-1 text-xs text-muted-foreground">Mealie: {target.linkedFoods.map(food => food.name).join(', ')}</p> : null}</TableCell>
        {providers.map(provider => {
          const own = catalog.mappings.filter(mapping => mapping.providerId === provider.id && forTarget(mapping, target));
          const main = own.find(mapping => mapping.role === 'preferred' && mapping.targetKind === target.kind && mapping.targetId === target.id) ?? own.find(mapping => mapping.role === 'preferred');
          const product = catalog.products.find(product => product.providerId === provider.id && product.externalId === main?.retailerProductId);
          const unitChanged = main && target.kind === 'grocy_product' && (main.targetKind !== target.kind || target.baseUnitId !== main.packageBaseUnitId);
          return <TableCell key={provider.id} className="block min-w-0 whitespace-normal md:table-cell md:min-w-64">
            <span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">{provider.name}</span>
            <div className="flex flex-wrap items-start gap-2"><div className="min-w-0 basis-full sm:basis-52 sm:flex-1"><RetailerSelect provider={provider} products={catalog.products} target={target} suggestions={catalog.suggestions} value={main?.retailerProductId ?? null} selectedName={main?.retailerProductName}
              onCatalog={mergeProducts} onChoose={product => { if (product && canChooseProduct(catalog, provider.id, product, target, 'preferred')) setEditing({ target, draft: { providerId: provider.id, product, role: 'preferred', mapping: main?.retailerProductId === product.externalId ? main : undefined } }); else if (!product && main) void remove(main); }} /></div>
              {main ? <div className="text-xs"><p>{conversionLabel(main, product)}</p><AppBadge small tone={main.confirmed && !unitChanged ? 'success' : 'warning'}>{unitChanged ? 'Unit changed; reconfirm' : main.confirmed ? 'confirmed' : 'Confirm amount'}</AppBadge></div> : null}</div>
            {product?.availability === 'discontinued' ? <p className="mt-1 text-xs text-destructive">Discontinued · list sync needs a text item or a new preferred product.</p> : product?.availability === 'temporarily_unavailable' ? <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Temporarily out of stock · preferred product stays on the list.</p> : main && (!product?.availability || product.availability === 'unknown') ? <p className="mt-1 text-xs text-muted-foreground">Availability unknown</p> : null}
            {main ? provider.installations.flatMap(installation => (installation.listReplacementBlocks ?? []).filter(block => block.retailerProductId === main.retailerProductId).map(block => <p key={`${installation.id}:${block.blockingRetailerProductId}:${block.blockingKind}`} className="mt-1 text-xs text-amber-600 dark:text-amber-400">Waiting for {block.blockingProductName} to leave the list ({installation.name}). Review the old line in Shop Overview if it remains paused.</p>)) : null}
            {main && provider.installations.some(installation => installation.manualNoteProductIds?.includes(main.retailerProductId)) ? <p className="mt-1 text-xs text-primary">Text item for {provider.installations.filter(installation => installation.manualNoteProductIds?.includes(main.retailerProductId)).map(installation => installation.name).join(', ')}</p> : null}
            {own.length > (main ? 1 : 0) ? <p className="mt-1 text-xs text-muted-foreground">{own.filter(mapping => mapping.id !== main?.id).length} alternative(s)</p> : null}
          </TableCell>;
        })}
        <TableCell className="block md:table-cell"><div className="flex justify-end"><Button size="sm" variant="outline" onClick={() => setEditing({ target })}><Pencil className="size-3.5" /> Edit</Button></div></TableCell>
      </TableRow>)}</TableBody>
    </Table>
    {!loading && !pageWindow.total && !error ? <p className="text-sm text-muted-foreground">No products match these filters.</p> : null}
    <Pagination themedPageSize window={pageWindow} onOffsetChange={setOffset} onPageSizeChange={value => { setPageSize(value); setOffset(0); }} disabled={loading} itemLabel="own products" />
    {catalog.searches?.length ? <section className="space-y-2"><h3 className="text-sm font-bold">Shopping ingredients to map</h3>{catalog.searches.map(search => <div key={search.id} className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm"><div className="min-w-0 flex-1"><b>{search.targetName}</b> · {search.status === 'pending' ? 'Waiting for catalogue search' : search.lastError ?? `Found ${search.resultCount} products`}</div><Button className="ml-auto" size="sm" variant="ghost" disabled={search.status === 'pending'} onClick={async () => { try { await apiJson(`/api/shop/searches/${search.id}/retry`, { method: 'POST', body: '{}' }); await loadCatalog(); } catch (err) { toast.error((err as Error).message); } }}>Search again</Button></div>)}</section> : null}
    {catalog.suggestions.length ? <section className="space-y-2 rounded-xl border border-primary/30 bg-primary/10 p-3"><h3 className="text-sm font-bold">Suggestions</h3>{(allSuggestions ? catalog.suggestions : catalog.suggestions.slice(0, 5)).map(suggestion => <div key={suggestion.id} className="flex flex-wrap items-center gap-2 rounded-md border bg-background/40 p-2 text-sm"><span>{catalog.products.find(product => product.providerId === suggestion.providerId && product.externalId === suggestion.retailerProductId)?.name ?? suggestion.retailerProductId}</span><ArrowRight className="size-3" /><b>{suggestion.targetName}</b><AppBadge small>{suggestion.providerId} · {Math.round(suggestion.score * 100)}%</AppBadge><div className="ml-auto flex justify-end gap-2">{(['accept', 'reject'] as const).map(action => <Button key={action} size="sm" variant={action === 'accept' ? 'outline' : 'ghost'} onClick={async () => { try { await apiJson(`/api/shop/suggestions/${suggestion.id}`, { method: 'POST', body: JSON.stringify({ action }) }); toast.success(action === 'accept' ? 'Mapping saved; confirm its package amount in Edit' : 'Suggestion rejected'); await reload(); } catch (err) { toast.error((err as Error).message); } }}>{action === 'accept' ? <Check className="size-3" /> : <X className="size-3" />}{action === 'accept' ? 'Accept' : 'Reject'}</Button>)}</div></div>)}{catalog.suggestions.length > 5 ? <Button size="sm" variant="ghost" onClick={() => setAllSuggestions(value => !value)}>{allSuggestions ? 'Show fewer' : 'Show all suggestions'}</Button> : null}</section> : null}
    {editing ? <ProductEditor lines={overview.lines} key={`${editing.target.kind}:${editing.target.id}`} target={editing.target} initialDraft={editing.draft} providers={providers} catalog={catalog} units={inventory?.mealieUnits ?? []} onCatalog={mergeProducts} reload={reload} onClose={() => setEditing(null)} /> : null}
  </div>;
}

function ProductEditor({ target, initialDraft, providers, catalog, units, lines, onCatalog, reload, onClose }: {
  target: TargetOption; initialDraft?: Draft; providers: Provider[]; catalog: CatalogData; units: Inventory['mealieUnits']; lines: ShopOverview['lines']; onCatalog: (products: ShopProduct[]) => void; reload: () => Promise<void>; onClose: () => void;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  const [draft, setDraft] = useState<Draft | null>(initialDraft ?? null);
  const [adding, setAdding] = useState<string | null>(null);
  const [fallbackAccounts, setFallbackAccounts] = useState<Record<string, string>>({});
  const [fallbackSaving, setFallbackSaving] = useState<string | null>(null);
  async function remove(mapping: Mapping) {
    try { await apiJson(`/api/shop/mappings/${mapping.id}`, { method: 'DELETE' }); await reload(); if (draft?.mapping?.id === mapping.id) setDraft(null); }
    catch (err) { toast.error('Could not remove mapping', { description: (err as Error).message }); }
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent initialFocus={title} className="max-h-[calc(100dvh-2rem)] overflow-y-auto break-words sm:max-w-3xl [&_[data-slot=button]]:h-auto [&_[data-slot=button]]:min-h-10 [&_[data-slot=button]]:whitespace-normal md:[&_[data-slot=button]]:min-h-8">
    <DialogHeader><DialogTitle ref={title} tabIndex={-1}>Shop mappings · {target.name}</DialogTitle><DialogDescription>({sourceLabel(target)}) {target.kind === 'grocy_product' ? `Stock unit: ${target.baseUnitName ?? 'missing'}.` : 'Choose a Mealie base unit for each mapping.'} Alternatives recognize replacement purchases and are never automatically added to the physical list.</DialogDescription></DialogHeader>
    {providers.map(provider => {
      const mappings = catalog.mappings.filter(mapping => mapping.providerId === provider.id && forTarget(mapping, target));
      const main = mappings.find(mapping => mapping.role === 'preferred' && mapping.targetKind === target.kind && mapping.targetId === target.id) ?? mappings.find(mapping => mapping.role === 'preferred');
      const alternatives = mappings.filter(mapping => mapping.id !== main?.id);
      const fallbackAccount = provider.installations.find(installation => installation.id === fallbackAccounts[provider.id]) ?? provider.installations.find(installation => installation.connected) ?? provider.installations[0];
      const manualNote = Boolean(main && fallbackAccount.manualNoteProductIds?.includes(main.retailerProductId));
      const mainProduct = catalog.products.find(product => product.providerId === provider.id && product.externalId === main?.retailerProductId);
      const canWriteNotes = fallbackAccount.features?.includes('list.notes');
      const choose = (product: ShopProduct | null, role: 'preferred' | 'alternative', mapping?: Mapping) => {
        if (product && canChooseProduct(catalog, provider.id, product, target, role, mapping?.id)) { setDraft({ providerId: provider.id, product, role, mapping: product.externalId === mapping?.retailerProductId ? mapping : undefined, replaces: product.externalId !== mapping?.retailerProductId ? mapping : undefined }); setAdding(null); }
        else if (!product && mapping) void remove(mapping);
      };
      return <section key={provider.id} className="space-y-3 rounded-md border bg-muted/20 p-3">
        <h3 className="text-sm font-bold">{provider.name}</h3>
        {[main, ...alternatives].map((mapping, index) => <div key={mapping?.id ?? 'preferred'} className="space-y-1">
          <p className="text-xs font-medium">{mapping?.targetKind === 'mealie_food' && target.kind === 'grocy_product' ? `Linked Mealie mapping · ${mapping.targetName}` : index === 0 ? 'Preferred product' : 'Alternative'}</p>
          <div className="flex flex-wrap items-start gap-2"><div className="min-w-0 basis-full sm:basis-52 sm:flex-1"><RetailerSelect provider={provider} products={catalog.products} target={target} suggestions={catalog.suggestions} value={mapping?.retailerProductId ?? null} selectedName={mapping?.retailerProductName} onCatalog={onCatalog} onChoose={product => choose(product, index === 0 ? 'preferred' : 'alternative', mapping)} /></div>
            {mapping ? <><Button size="sm" variant="outline" onClick={() => {
              const product = catalog.products.find(product => product.providerId === provider.id && product.externalId === mapping.retailerProductId);
              if (product) setDraft({ providerId: provider.id, product, role: mapping.role === 'preferred' ? 'preferred' : 'alternative', mapping });
            }}>Unit &amp; amount</Button>{index > 0 ? <Button size="sm" variant="outline" onClick={async () => { if (mapping.targetKind !== target.kind || mapping.targetId !== target.id) { const product = catalog.products.find(product => product.providerId === provider.id && product.externalId === mapping.retailerProductId); if (product) setDraft({ providerId: provider.id, product, role: 'preferred', mapping }); return; } try { await apiJson(`/api/shop/mappings/${mapping.id}`, { method: 'PATCH', body: JSON.stringify({ role: 'preferred' }) }); await reload(); } catch (err) { toast.error((err as Error).message); } }}>Use as preferred</Button> : null}<Button aria-label={`Remove ${mapping.retailerProductName}`} size="sm" variant="ghost" onClick={() => void remove(mapping)}><Trash2 className="size-3.5" /></Button></> : null}</div>
          {mapping ? <p className="text-xs text-muted-foreground">{conversionLabel(mapping, catalog.products.find(product => product.providerId === provider.id && product.externalId === mapping.retailerProductId))} · {mapping.confirmed ? 'confirmed' : 'needs confirmation'}</p> : null}
        </div>)}
        {main ? <div className="space-y-2 rounded-md border bg-background/50 p-2 text-xs">
          {provider.installations.length > 1 ? <ThemedSelect ariaLabel={`Text item account for ${provider.name}`} value={fallbackAccount.id} options={provider.installations.map(installation => ({ value: installation.id, label: `${installation.name}${installation.accountLabel ? ` · ${installation.accountLabel}` : ''}` }))} onChange={id => setFallbackAccounts(current => ({ ...current, [provider.id]: id }))} className="w-full" /> : null}
          {(fallbackAccount.listReplacementBlocks ?? []).filter(block => block.retailerProductId === main.retailerProductId).map(block => <p key={`${block.blockingRetailerProductId}:${block.blockingKind}`} className="text-amber-600 dark:text-amber-400">Waiting for {block.blockingProductName} to leave the list. Resolve its pause in Shop Overview if needed.</p>)}
          <p>{mainProduct?.availability === 'discontinued' ? 'This discontinued product uses a text item automatically when supported.' : manualNote ? 'This account uses one ingredient and quantity text item instead of the preferred product.' : 'If this product cannot be added, use one ingredient and quantity text item for this account.'}</p>
          {lines.some(line => line.installationId === fallbackAccount.id && line.retailerProductId === main.retailerProductId && line.kind !== 'note' && line.pausedReason && line.pausedReason !== 'released') ? <p className="text-amber-600 dark:text-amber-400">Waiting for the paused product line. Review and resolve it in Shop Overview before the text item can replace it.</p> : null}
          <Button size="sm" variant="outline" disabled={!canWriteNotes || !fallbackAccount.settings.boundAccountKey || fallbackSaving === provider.id || (manualNote && mainProduct?.availability === 'discontinued')} onClick={async () => {
            setFallbackSaving(provider.id);
            try { await apiJson('/api/shop/lists/fallback', { method: 'POST', body: JSON.stringify({ installationId: fallbackAccount.id, retailerProductId: main.retailerProductId, mode: manualNote ? 'product' : 'note' }) }); await reload(); toast.success(manualNote ? 'Preferred product restored for this account' : 'Text fallback selected for this account'); }
            catch (err) { toast.error('Could not change list fallback', { description: (err as Error).message }); }
            finally { setFallbackSaving(null); }
          }}>{fallbackSaving === provider.id ? <Loader2 className="size-3.5 animate-spin" /> : null}{manualNote ? 'Use preferred product' : 'Use text item'}</Button>
          {!canWriteNotes ? <p className="text-muted-foreground">This plugin does not support text items.</p> : null}
        </div> : null}
        {adding === provider.id ? <RetailerSelect provider={provider} products={catalog.products} target={target} suggestions={catalog.suggestions} value={null} onCatalog={onCatalog} onChoose={product => choose(product, 'alternative')} /> : null}
        <Button size="sm" variant="outline" onClick={() => setAdding(provider.id)}><Plus className="size-3.5" /> Add alternative</Button>
        {draft?.providerId === provider.id ? <MappingForm key={`${draft.product.externalId}:${draft.role}:${draft.mapping?.id ?? 'new'}`} target={target} draft={draft} units={units} onSaved={async () => { await reload(); setDraft(null); }} onCancel={() => setDraft(null)} /> : null}
      </section>;
    })}
    <div className="flex justify-end"><Button size="sm" variant="outline" onClick={onClose}>Done</Button></div>
  </DialogContent></Dialog>;
}

function MappingForm({ target, draft, units, onSaved, onCancel }: { target: TargetOption; draft: Draft; units: Inventory['mealieUnits']; onSaved: () => Promise<void>; onCancel: () => void }) {
  const [unit, setUnit] = useState(draft.mapping ? draft.mapping.packageBaseUnitId ?? '' : target.baseUnitId ?? '');
  const [amount, setAmount] = useState(target.kind === 'grocy_product' && draft.mapping && (draft.mapping.targetKind !== target.kind || draft.mapping.packageBaseUnitId !== target.baseUnitId) ? '' : draft.mapping?.packageBaseAmount?.toString() ?? '');
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof mappingPreview>> | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [baseChosen, setBaseChosen] = useState(target.kind === 'grocy_product' || Boolean(draft.mapping) || Boolean(target.baseUnitId));
  useEffect(() => {
    let cancelled = false; setPreview(null); setError('');
    void apiJson<Awaited<ReturnType<typeof mappingPreview>>>('/api/shop/mappings/preview', { method: 'POST', body: JSON.stringify({ providerId: draft.providerId, retailerProductId: draft.product.externalId, targetKind: target.kind, targetId: target.id, baseUnitId: unit || null }) }).then(result => { if (!cancelled) setPreview(result); }).catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [draft.providerId, draft.product.externalId, target.kind, target.id, unit, attempt]);
  const baseName = target.kind === 'grocy_product' ? preview?.baseUnitName ?? target.baseUnitName : units.find(candidate => candidate.id === unit)?.name ?? 'items';
  const changedUnit = target.kind === 'grocy_product' && preview && preview.baseUnitId !== target.baseUnitId;
  const unavailable = draft.product.availability === 'discontinued';
  const deletedUnit = target.kind === 'mealie_food' && unit !== '' && !units.some(candidate => candidate.id === unit);
  async function save() {
    const parsed = Number(amount);
    if (!baseChosen || !(parsed > 0) || !Number.isFinite(parsed) || !preview || changedUnit || unavailable || deletedUnit) return;
    setSaving(true);
    try {
      const saved = await apiJson<{ warnings: string[] }>('/api/shop/mappings', { method: 'POST', body: JSON.stringify({ providerId: draft.providerId, retailerProductId: draft.product.externalId, targetKind: target.kind, targetId: target.id, targetName: target.name, role: draft.role, baseUnitId: target.kind === 'grocy_product' ? preview.baseUnitId : unit || null, baseUnitName: baseName, packageBaseAmount: parsed, confirm: true, replacesMappingId: draft.role === 'alternative' ? draft.replaces?.id : undefined }) });
      if (saved.warnings?.includes('availability_unknown')) toast.warning('Mapping saved; current availability could not be verified.');
      toast.success('Mapping and package amount confirmed'); await onSaved();
    } catch (err) { toast.error('Could not save mapping', { description: (err as Error).message }); }
    finally { setSaving(false); }
  }
  return <div className="space-y-2 rounded-md border border-primary/30 bg-background p-3 text-sm">
    <p className="font-semibold">{draft.product.name} · {draft.role}</p>
    {draft.mapping && (draft.mapping.targetKind !== target.kind || draft.mapping.targetId !== target.id) ? <p className="text-xs text-amber-600 dark:text-amber-400">This was mapped directly to the linked Mealie ingredient. Confirm an amount in the Grocy stock unit to move it to this canonical product.</p> : null}
    {target.kind === 'mealie_food' ? <SearchableSelect className="w-full" ariaLabel="Base unit" placeholder="Choose Mealie base unit" clearable={false} value={baseChosen ? unit : null} options={[{ value: '', label: 'Count (items)' }, ...units.map(unit => ({ value: unit.id, label: unit.name }))]} onChange={value => { setUnit(value ?? ''); setBaseChosen(true); setAmount(''); }} /> : <p className="text-xs">Grocy stock unit: {baseName ?? 'missing'}</p>}
    <div className="flex flex-wrap items-center gap-2"><span className="text-xs">1 {draft.product.measure === 'weight' ? 'kg' : 'package'} =</span><AppInput className="w-24" inputMode="decimal" aria-label="Amount per package" value={amount} onChange={event => setAmount(event.target.value)} /><span className="text-xs">{baseName}</span></div>
    {preview?.derivation ? <div className="flex flex-wrap items-center gap-2 text-xs"><span>Suggested: {preview.derivation.explanation}. Check against the package.</span><Button size="sm" variant="outline" onClick={() => setAmount(String(preview.derivation!.amount))}>Use suggested amount</Button></div> : <p className="text-xs text-muted-foreground">Enter the amount shown on the package or receipt. Unknown conversions are never guessed.</p>}
    {changedUnit ? <p className="text-xs text-destructive" role="alert">The Grocy stock unit changed. Close this dialog and refresh the products before confirming.</p> : null}
    {deletedUnit ? <p className="text-xs text-destructive" role="alert">This Mealie unit is no longer available; choose another unit.</p> : null}
    {unavailable ? <p className="text-xs text-destructive" role="alert">This product is discontinued. Choose a current product; the existing mapping is kept.</p> : null}
    {error ? <p className="text-xs text-destructive" role="alert">{error}<Button size="sm" variant="ghost" onClick={() => setAttempt(value => value + 1)}>Retry preview</Button></p> : null}
    {preview?.demandConversions?.map(conversion => <p key={conversion.mealieItemId} className="text-xs">{conversion.mealieUnitName}: {conversion.ok ? `${conversion.amount} ${preview.baseUnitName}` : `Needs configuration (${conversion.reason})`}</p>)}
    <a className="text-xs text-primary underline" href="/conversions">Units &amp; Conversions</a>
    <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button><Button size="sm" onClick={() => void save()} disabled={saving || !baseChosen || !preview || Boolean(changedUnit) || unavailable || deletedUnit || !(Number(amount) > 0) || !Number.isFinite(Number(amount))}>{saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Confirm mapping</Button></div>
  </div>;
}

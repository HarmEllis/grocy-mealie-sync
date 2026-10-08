'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, Check, LayoutDashboard, Link2, Loader2, Package, Receipt, RefreshCw, Search, TriangleAlert, Unlink, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppBadge, AppInput, ProgressRing } from '@/components/redesign/primitives';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { Pagination } from '@/components/mapping-wizard/Pagination';
import { buildPageWindow, DEFAULT_PAGE_SIZE } from '@/components/mapping-wizard/paging';
import { apiJson } from './api';
import type { ShopOverview } from '@/lib/shop/overview';

type Tab = 'overview' | 'products' | 'receipts' | 'review';

const PAUSE_LABELS: Record<string, string> = {
  reduced_by_other: 'Someone reduced this line',
  line_missing: 'The line disappeared',
  duplicate_lines: 'The product is on the list more than once',
  line_reused: 'The line now holds another product',
};

const REVIEW_LABELS: Record<string, string> = {
  unknown_product: 'The retailer did not identify the product',
  mapping_missing: 'No product mapping yet',
  mapping_unconfirmed: 'The package amount is not confirmed',
  invalid_quantity: 'Return or correction',
  unit_mismatch: 'The receipt unit does not fit the mapping',
  mapping_unit_changed: 'The product unit changed; confirm the mapping again',
  ambiguous_credit: 'Several manual checks could match',
};

function money(cents: number | null | undefined): string {
  return typeof cents === 'number' ? (cents / 100).toFixed(2) : '';
}

function when(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

async function post(url: string, body: unknown, success: string): Promise<boolean> {
  try {
    await apiJson(url, { method: 'POST', body: JSON.stringify(body) });
    toast.success(success);
    return true;
  } catch (error) {
    toast.error('Action failed', { description: (error as Error).message });
    return false;
  }
}

function ShopSection({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 space-y-3 ${className}`}>
      <div className="space-y-1">
        <h2 className="text-sm font-bold text-text-1">{title}</h2>
        {subtitle ? <p className="text-xs text-text-3">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

// Use the Mapping table components, retaining one set of controls on mobile.
function ShopTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <Table containerClassName="min-w-0 rounded-md border md:rounded-md max-md:border-0"
      className="block md:table md:min-w-[720px] [&_tbody]:block md:[&_tbody]:table-row-group [&_tbody>tr]:mb-3 [&_tbody>tr]:block [&_tbody>tr]:rounded-md [&_tbody>tr]:border [&_tbody>tr]:border-border [&_tbody>tr]:p-3 md:[&_tbody>tr]:mb-0 md:[&_tbody>tr]:table-row md:[&_tbody>tr]:rounded-none md:[&_tbody>tr]:border-0 md:[&_tbody>tr]:border-b md:[&_tbody>tr]:p-0">
      <TableHeader className="hidden bg-muted/30 md:table-header-group">
        <TableRow>{headers.map((header, index) => <TableHead key={index} scope="col">{header}</TableHead>)}</TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  );
}

function ShopCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TableCell className="block min-w-0 break-words py-1.5 align-top whitespace-normal md:table-cell md:p-2">
      <span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">{label}</span>
      {children}
    </TableCell>
  );
}

export function ShoppingDashboard() {
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

  const attention = (overview?.review.length ?? 0) + (overview?.discrepancies.length ?? 0) + (overview?.effects.length ?? 0)
    + (overview?.lines.filter(line => line.pausedReason && line.pausedReason !== 'released').length ?? 0);

  return (
    <div className="min-w-0 space-y-4 break-words [&_[data-slot=button]]:h-auto [&_[data-slot=button]]:min-h-10 [&_[data-slot=button]]:max-w-full [&_[data-slot=button]]:whitespace-normal md:[&_[data-slot=button]]:min-h-8">
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Refresh
        </Button>
        <Button size="sm" variant="outline" onClick={async () => { if (await post('/api/shop/run', {}, 'Shop sync requested')) void load(); }}>
          Sync lists now
        </Button>
        {attention > 0 ? <AppBadge tone="warning">{attention} item(s) need attention</AppBadge> : null}
      </div>

      {overview && overview.installations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No shop plugins are installed. Add one under Settings → Shop plugins. Without plugins the regular sync is unchanged.
        </p>
      ) : null}

      <Tabs value={tab} onValueChange={value => setTab(value as Tab)}>
        <div className="-mx-2 overflow-x-auto overflow-y-hidden border-b border-border px-2 pb-0.5">
          <TabsList variant="line" className="h-10 min-w-max gap-0 bg-transparent p-0 md:h-8">
            <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent px-4 py-2 data-active:border-primary data-active:text-primary"><LayoutDashboard className="size-3.5" /> Overview</TabsTrigger>
            <TabsTrigger value="products" className="rounded-none border-b-2 border-transparent px-4 py-2 data-active:border-primary data-active:text-primary"><Package className="size-3.5" /> Products</TabsTrigger>
            <TabsTrigger value="receipts" className="rounded-none border-b-2 border-transparent px-4 py-2 data-active:border-primary data-active:text-primary"><Receipt className="size-3.5" /> Receipts</TabsTrigger>
            <TabsTrigger value="review" className="rounded-none border-b-2 border-transparent px-4 py-2 data-active:border-primary data-active:text-primary"><TriangleAlert className="size-3.5" /> Review{attention > 0 ? ` (${attention})` : ''}</TabsTrigger>
          </TabsList>
        </div>
        <p className="text-[11px] text-text-3 md:hidden">Swipe tabs to view all sections.</p>
        <TabsContent value="overview">{overview ? <OverviewTab overview={overview} reload={load} /> : null}</TabsContent>
        <TabsContent value="products">{overview ? <ProductsTab overview={overview} /> : null}</TabsContent>
        <TabsContent value="receipts">{overview ? <ReceiptsTab overview={overview} reload={load} /> : null}</TabsContent>
        <TabsContent value="review">{overview ? <ReviewTab overview={overview} reload={load} /> : null}</TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ overview, reload }: { overview: ShopOverview; reload: () => Promise<void> }) {
  const installationName = (id: string) => overview.installations.find(installation => installation.id === id)?.name ?? id;
  const paused = overview.lines.filter(line => line.pausedReason && line.pausedReason !== 'released');
  return (
    <div className="space-y-4">
      <ShopSection title="Plugins">
        <ul className="divide-y divide-border rounded-md border bg-muted/20 text-sm">
          {overview.installations.map(installation => (
            <li key={installation.id} className="flex flex-wrap items-center gap-2 px-3 py-3">
              <span className="font-semibold">{installation.name}</span>
              <AppBadge small tone={installation.connected ? 'success' : 'default'}>{installation.connected ? 'connected' : 'offline'}</AppBadge>
              {installation.settings.listSyncEnabled ? <AppBadge small>list sync</AppBadge> : null}
              {installation.settings.receiptsEnabled ? <AppBadge small>receipts</AppBadge> : null}
              {installation.pendingListApply ? <AppBadge small tone="warning">list write pending confirmation</AppBadge> : null}
            </li>
          ))}
        </ul>
      </ShopSection>

      <ShopSection title="On the shared list" subtitle="Packages gm-sync currently wants on each retailer list. Your own additions are kept.">
        {overview.exports.length === 0 ? <p className="text-sm text-muted-foreground">Nothing exported.</p> : (
          <ShopTable headers={['Plugin', 'Product', 'Packages', 'Since']}>
              {overview.exports.map(row => (
                <TableRow key={row.id}><ShopCell label="Plugin">{installationName(row.installationId)}</ShopCell><ShopCell label="Product">{row.productName}</ShopCell><ShopCell label="Packages">{row.packages}</ShopCell><ShopCell label="Since">{when(row.createdAt)}</ShopCell></TableRow>
              ))}
          </ShopTable>
        )}
      </ShopSection>

      <ShopSection title="Paused list lines" subtitle="gm-sync never guesses whose units disappeared. Tell it what happened.">
        {paused.length === 0 ? <p className="text-sm text-muted-foreground">No paused lines.</p> : (
          <ul className="space-y-2">
            {paused.map(line => (
              <li key={`${line.installationId}:${line.retailerProductId}`} className="space-y-1 rounded-md border border-border bg-muted/20 p-3 text-sm">
                <div><span className="font-semibold">{line.productName}</span> · {PAUSE_LABELS[line.pausedReason ?? ''] ?? line.pausedReason} · now {line.pausedObservedQty ?? 0}, last written {line.lastWrittenQty}</div>
                <div className="flex flex-wrap gap-2">
                  {(['user_units_removed', 'readd', 'release'] as const).map(resolution => (
                    <Button
                      key={resolution}
                      size="sm"
                      variant="outline"
                      disabled={(line.pausedReason === 'duplicate_lines' || line.pausedReason === 'line_reused') && resolution !== 'release'}
                      onClick={async () => {
                        if (await post('/api/shop/lines/resolve', { installationId: line.installationId, retailerProductId: line.retailerProductId, resolution }, 'Line updated')) await reload();
                      }}
                    >
                      {resolution === 'user_units_removed' ? 'Someone removed their own units' : resolution === 'readd' ? 'Add mine again' : 'Release this line'}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </ShopSection>
    </div>
  );
}

interface MappingRow {
  id: string;
  providerId: string;
  retailerProductId: string;
  retailerProductName: string;
  targetKind: string;
  targetId: string;
  targetName: string;
  role: string;
  packageBaseAmount: number | null;
  packageBaseUnitId: string | null;
  packageBaseUnitName: string | null;
  packageSource: string | null;
  confirmed: boolean;
}

interface ProductRow { providerId: string; externalId: string; name: string; packageAmount: number | null; packageUnit: string | null; measure: string }
interface SuggestionRow { id: string; retailerProductId: string; targetKind: string; targetId: string; targetName: string; score: number }
interface CatalogSearchRow { id: string; targetName: string; status: string; resultCount: number; lastError: string | null }
interface TargetOption { kind: 'grocy_product' | 'mealie_food'; id: string; name: string; baseUnitId: string | null; baseUnitName: string | null }

function ProductsTab({ overview }: { overview: ShopOverview }) {
  const providers = useMemo(() => [...new Set(overview.installations.map(installation => installation.providerId).filter((id): id is string => Boolean(id)))], [overview]);
  const [providerId, setProviderId] = useState<string>('');
  const [data, setData] = useState<{ mappings: MappingRow[]; products: ProductRow[]; suggestions: SuggestionRow[]; searches?: CatalogSearchRow[] } | null>(null);
  const [query, setQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [productFilter, setProductFilter] = useState<'all' | 'available' | 'mapped'>('all');
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const activeProvider = providerId || providers[0] || '';
  const connected = overview.installations.find(installation => installation.providerId === activeProvider && installation.connected);

  const load = useCallback(async () => {
    if (!activeProvider) return;
    try {
      setData(await apiJson(`/api/shop/mappings?providerId=${encodeURIComponent(activeProvider)}`));
    } catch (error) {
      toast.error('Could not load mappings', { description: (error as Error).message });
    }
  }, [activeProvider]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(load, 15_000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => { setOffset(0); }, [productQuery, productFilter, activeProvider]);

  if (!activeProvider) return <p className="text-sm text-muted-foreground">Connect a plugin first; mappings are kept per retailer.</p>;
  const mappingByProduct = new Map((data?.mappings ?? []).map(mapping => [mapping.retailerProductId, mapping]));
  const products = data?.products ?? [];
  const mappedCount = products.filter(product => mappingByProduct.has(product.externalId)).length;
  const normalizedQuery = productQuery.trim().toLocaleLowerCase();
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  const visibleProducts = products.filter(product => {
    const mapping = mappingByProduct.get(product.externalId);
    if (productFilter === 'mapped' && !mapping) return false;
    if (productFilter === 'available' && mapping) return false;
    return !normalizedQuery || `${product.name} ${mapping?.targetName ?? ''}`.toLocaleLowerCase().includes(normalizedQuery);
  }).sort((a, b) => collator.compare(a.name, b.name) || collator.compare(a.externalId, b.externalId));

  const pageWindow = buildPageWindow(visibleProducts, offset, pageSize);

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <ProgressRing value={mappedCount} max={products.length} size={44} color={mappedCount < products.length ? '#fbbf24' : '#4ade80'} />
        <div>
          <p className="text-xs font-bold text-text-1">Retailer product mappings</p>
          <p className="text-[11px] text-text-3">{mappedCount} mapped · {products.length - mappedCount} available to map</p>
        </div>
        {data?.suggestions.length ? <AppBadge tone="accent" small>{data.suggestions.length} suggestions</AppBadge> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
        {providers.length > 1 ? (
          <SearchableSelect options={providers.map(id => ({ value: id, label: id }))} value={activeProvider} onChange={value => { if (value !== null) setProviderId(value); }} ariaLabel="Retailer" clearable={false} className="w-full sm:w-44" />
        ) : <AppBadge>{activeProvider}</AppBadge>}
        <form
          className="flex w-full min-w-0 items-center gap-2 sm:w-auto"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!connected || !query.trim()) return;
            try {
              await apiJson(`/api/plugins/installations/${connected.id}/catalog?query=${encodeURIComponent(query.trim())}`);
              await load();
            } catch (error) {
              toast.error('Catalogue search failed', { description: (error as Error).message });
            }
          }}
        >
          <AppInput className="min-w-0 flex-1" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search the retailer catalogue" aria-label="Catalogue search" />
          <Button size="sm" type="submit" disabled={!connected}><Search className="size-4" /> Search</Button>
        </form>
      </div>

      {data?.searches?.length ? (
        <ShopSection title="Shopping ingredients to map" subtitle="New Mealie ingredients are searched automatically. Choose a product below and confirm its package amount before it goes to the retailer list.">
          <ul className="space-y-2 text-sm">
            {data.searches.map(search => (
              <li key={search.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/20 p-3">
                <div className="min-w-0 flex-1">
                  <span className="font-semibold">{search.targetName}</span>{' · '}
                  {search.status === 'pending' ? 'Waiting for the connected plugin to search' : search.status === 'error'
                    ? search.lastError : search.resultCount ? `Found ${search.resultCount} products; review the suggestions or use Map below` : 'No products found; try a manual catalogue search'}
                </div>
                {search.status !== 'pending' ? (
                  <Button className="ml-auto shrink-0" size="sm" variant="ghost" onClick={async () => {
                    if (await post(`/api/shop/searches/${search.id}/retry`, {}, 'Catalogue search queued')) await load();
                  }}>Search again</Button>
                ) : null}
              </li>
            ))}
          </ul>
        </ShopSection>
      ) : null}

      {data?.suggestions.length ? (
        <ShopSection className="rounded-xl border border-primary/30 bg-primary/10 p-3 shadow-[0_0_20px_color-mix(in_oklab,var(--accent)_20%,transparent)]" title="Suggestions" subtitle="Choose a retailer product for your ingredient, then confirm its package amount.">
          <ul className="space-y-1 text-sm">
            {(showAllSuggestions ? data.suggestions : data.suggestions.slice(0, 5)).map(suggestion => (
              <li key={suggestion.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                <span>{data.products.find(product => product.externalId === suggestion.retailerProductId)?.name ?? suggestion.retailerProductId}</span>
                <ArrowRight className="size-3 shrink-0 text-text-3" /><span className="font-semibold text-primary">{suggestion.targetName}</span><AppBadge tone="accent" small>{Math.round(suggestion.score * 100)}%</AppBadge>
                <div className="ml-auto flex shrink-0 justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={async () => { if (await post(`/api/shop/suggestions/${suggestion.id}`, { action: 'accept' }, 'Mapping created; confirm its package amount')) await load(); }}><Check className="size-3.5" /> Accept</Button>
                  <Button size="sm" variant="ghost" onClick={async () => { if (await post(`/api/shop/suggestions/${suggestion.id}`, { action: 'reject' }, 'Suggestion rejected')) await load(); }}><X className="size-3.5" /> Reject</Button>
                </div>
              </li>
            ))}
          </ul>
          {data.suggestions.length > 5 ? <Button size="sm" variant="ghost" onClick={() => setShowAllSuggestions(value => !value)}>{showAllSuggestions ? 'Show fewer suggestions' : `Show ${data.suggestions.length - 5} more suggestions`}</Button> : null}
        </ShopSection>
      ) : null}

      <ShopSection title="Retailer products" subtitle="Automatic list and receipt processing only uses confirmed mappings.">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <AppInput className="min-w-0 flex-1" aria-label="Filter retailer products" placeholder="Filter by product or mapped ingredient" value={productQuery} onChange={event => setProductQuery(event.target.value)} />
          <SearchableSelect ariaLabel="Product mapping filter" value={productFilter} onChange={value => { if (value !== null) setProductFilter(value); }} clearable={false} className="w-full sm:w-64" options={[
            { value: 'all', label: `All products (${products.length})` },
            { value: 'available', label: `Available to map (${products.length - mappedCount})` },
            { value: 'mapped', label: `Mapped (${mappedCount})` },
          ]} />
        </div>
        {visibleProducts.length === 0 ? <p className="text-sm text-muted-foreground">No products match these filters.</p> : null}
        <ShopTable headers={['Product', 'Package', 'Mapped to', 'Amount per package', 'Actions']}>
            {pageWindow.rows.map((product) => {
              const mapping = mappingByProduct.get(product.externalId);
              return (
                <TableRow key={product.externalId} className={mapping ? 'bg-success/5' : undefined} data-testid="retailer-product">
                  <ShopCell label="Product"><span className="font-semibold">{product.name}</span></ShopCell>
                  <ShopCell label="Package">{product.measure === 'weight' ? 'by weight (per kg)' : `${product.packageAmount ?? ''} ${product.packageUnit ?? ''}`}</ShopCell>
                  <ShopCell label="Mapped to">
                    {mapping ? <div className="space-y-1">
                      <p>{mapping.targetName} ({mapping.targetKind === 'grocy_product' ? 'Grocy' : 'Mealie only'})</p>
                      <AppBadge small tone={mapping.role === 'preferred' ? 'accent' : 'warning'}>{mapping.role === 'preferred' ? 'Preferred for list sync' : 'Alternative; not sent to list'}</AppBadge>
                    </div> : '—'}
                  </ShopCell>
                  <ShopCell label="Amount per package">
                    {mapping ? (
                      <MappingAmount mapping={mapping} onSaved={load} />
                    ) : null}
                  </ShopCell>
                  <ShopCell label="Actions"><div className="flex flex-wrap gap-2 md:justify-end">
                    <Button size="sm" variant="outline" onClick={() => setEditing(product)}><Link2 className="size-3.5" />{mapping ? 'Change' : 'Map'}</Button>
                    {mapping?.role === 'alternative' ? (
                      <Button size="sm" variant="outline" onClick={async () => {
                        try {
                          await apiJson(`/api/shop/mappings/${mapping.id}`, { method: 'PATCH', body: JSON.stringify({ role: 'preferred' }) });
                          toast.success('Preferred product selected for list sync');
                          await load();
                        } catch (error) {
                          toast.error('Could not select the preferred product', { description: (error as Error).message });
                        }
                      }}>Use for list</Button>
                    ) : null}
                    {mapping ? (
                      <Button size="sm" variant="ghost" onClick={async () => {
                        try {
                          await apiJson(`/api/shop/mappings/${mapping.id}`, { method: 'DELETE' });
                          await load();
                        } catch (error) {
                          toast.error('Could not remove the mapping', { description: (error as Error).message });
                        }
                      }}><Unlink className="size-3.5" /> Remove</Button>
                    ) : null}
                  </div></ShopCell>
                </TableRow>
              );
            })}
        </ShopTable>
        <Pagination searchablePageSize window={pageWindow} onOffsetChange={setOffset} onPageSizeChange={size => { setPageSize(size); setOffset(0); }} itemLabel="retailer products" />
      </ShopSection>

      {editing ? <MappingEditor providerId={activeProvider} product={editing} mapping={mappingByProduct.get(editing.externalId) ?? null} onClose={() => { setEditing(null); void load(); }} /> : null}
    </div>
  );
}

function MappingAmount({ mapping, onSaved }: { mapping: MappingRow; onSaved: () => Promise<void> }) {
  const [value, setValue] = useState(mapping.packageBaseAmount?.toString() ?? '');
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const amount = Number(value);
        if (!(amount > 0)) {
          toast.error('Enter a positive amount');
          return;
        }
        try {
          await apiJson(`/api/shop/mappings/${mapping.id}`, { method: 'PATCH', body: JSON.stringify({ packageBaseAmount: amount }) });
          toast.success('Package amount confirmed');
          await onSaved();
        } catch (error) {
          toast.error('Could not confirm', { description: (error as Error).message });
        }
      }}
    >
      <AppInput className="w-20 shrink-0" value={value} onChange={event => setValue(event.target.value)} inputMode="decimal" aria-label="Amount per package" />
      <span className="text-xs text-muted-foreground">{mapping.packageBaseUnitName ?? 'units'}</span>
      {mapping.confirmed ? <AppBadge small tone="success">confirmed</AppBadge> : <Button size="sm" type="submit" variant="outline">Confirm</Button>}
    </form>
  );
}

function MappingEditor({ providerId, product, mapping, onClose }: { providerId: string; product: ProductRow; mapping: MappingRow | null; onClose: () => void }) {
  const [query, setQuery] = useState(mapping?.targetName ?? product.name);
  const [targets, setTargets] = useState<TargetOption[]>([]);
  const [mealieUnits, setMealieUnits] = useState<Array<{ id: string; name: string }>>([]);
  const [selected, setSelected] = useState<TargetOption | null>(mapping && mapping.targetId ? {
    kind: mapping.targetKind as TargetOption['kind'], id: mapping.targetId, name: mapping.targetName,
    baseUnitId: mapping.packageBaseUnitId, baseUnitName: mapping.packageBaseUnitName,
  } : null);
  const [mealieUnitId, setMealieUnitId] = useState(mapping?.targetKind === 'mealie_food' ? mapping.packageBaseUnitId ?? '' : '');
  const [role, setRole] = useState<'preferred' | 'alternative'>(mapping?.role === 'alternative' ? 'alternative' : 'preferred');
  const [amount, setAmount] = useState(mapping?.packageBaseAmount?.toString() ?? '');

  async function search() {
    try {
      const result = await apiJson<{ targets: TargetOption[]; mealieUnits: Array<{ id: string; name: string }> }>(`/api/shop/targets?query=${encodeURIComponent(query)}`);
      setTargets(result.targets);
      setMealieUnits(result.mealieUnits);
    } catch (error) {
      toast.error('Search failed', { description: (error as Error).message });
    }
  }

  useEffect(() => { void search(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function save() {
    if (!selected) return;
    const baseUnit = selected.kind === 'grocy_product'
      ? { id: selected.baseUnitId, name: selected.baseUnitName }
      : { id: mealieUnitId || null, name: mealieUnits.find(unit => unit.id === mealieUnitId)?.name ?? null };
    const parsed = amount.trim() ? Number(amount) : null;
    if (parsed !== null && !(parsed > 0)) {
      toast.error('Enter a positive amount or leave it empty to derive it');
      return;
    }
    try {
      await apiJson('/api/shop/mappings', {
        method: 'POST',
        body: JSON.stringify({
          providerId,
          retailerProductId: product.externalId,
          targetKind: selected.kind,
          targetId: selected.id,
          targetName: selected.name,
          role,
          baseUnitId: baseUnit.id,
          baseUnitName: baseUnit.name,
          packageBaseAmount: parsed,
          confirm: parsed !== null,
        }),
      });
      toast.success(parsed !== null ? 'Mapping saved and confirmed' : 'Mapping saved; confirm the derived amount');
      onClose();
    } catch (error) {
      toast.error('Could not save the mapping', { description: (error as Error).message });
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto break-words sm:max-w-xl [&_[data-slot=button]]:h-auto [&_[data-slot=button]]:min-h-10 [&_[data-slot=button]]:whitespace-normal">
        <DialogHeader>
          <DialogTitle>Map {product.name}</DialogTitle>
          <DialogDescription>Pick a Grocy product, or a Mealie food when the item is not tracked in Grocy.</DialogDescription>
        </DialogHeader>
      <div className="space-y-3 text-sm">
        <form className="flex min-w-0 gap-2" onSubmit={(event) => { event.preventDefault(); void search(); }}>
          <AppInput className="min-w-0 flex-1" value={query} onChange={event => setQuery(event.target.value)} aria-label="Target search" />
          <Button size="sm" type="submit"><Search className="size-4" /> Find</Button>
        </form>
        <SearchableSelect
          className="w-full" ariaLabel="Target" placeholder="Choose a target…"
          value={selected ? `${selected.kind}:${selected.id}` : null}
          onChange={value => setSelected(targets.find(target => `${target.kind}:${target.id}` === value) ?? (value === (selected ? `${selected.kind}:${selected.id}` : null) ? selected : null))}
          extraOption={selected ? { value: `${selected.kind}:${selected.id}`, label: selected.kind === 'grocy_product' ? `Grocy: ${selected.name} (${selected.baseUnitName ?? 'stock unit'})` : `Mealie only: ${selected.name}` } : null}
          options={targets.map(target => ({ value: `${target.kind}:${target.id}`, label: target.kind === 'grocy_product' ? `Grocy: ${target.name} (${target.baseUnitName ?? 'stock unit'})` : `Mealie only: ${target.name}` }))}
        />
        {selected?.kind === 'mealie_food' ? (
          <SearchableSelect className="w-full" ariaLabel="Mealie unit" value={mealieUnitId} onChange={value => setMealieUnitId(value ?? '')} clearable={false} options={[{ value: '', label: 'Count (no unit)' }, ...mealieUnits.map(unit => ({ value: unit.id, label: unit.name }))]} />
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <SearchableSelect className="w-full sm:w-56" ariaLabel="Role" value={role} onChange={value => { if (value !== null) setRole(value); }} clearable={false} options={[{ value: 'preferred', label: 'Preferred product' }, { value: 'alternative', label: 'Remembered alternative' }]} />
          <AppInput className="w-28" value={amount} onChange={event => setAmount(event.target.value)} placeholder="Amount" inputMode="decimal" aria-label="Amount per package" />
          <span className="text-xs text-muted-foreground">
            {product.measure === 'weight' ? 'per kg' : 'per package'} in {selected?.kind === 'grocy_product' ? selected.baseUnitName ?? 'the stock unit' : 'the chosen unit'}
          </span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={!selected}>Save mapping</Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptsTab({ overview, reload }: { overview: ShopOverview; reload: () => Promise<void> }) {
  return (
    <div className="space-y-3">
      <Button size="sm" variant="outline" onClick={async () => { if (await post('/api/shop/receipts/pull', {}, 'Receipt pull requested')) window.setTimeout(() => void reload(), 3000); }}>
        Pull receipts now
      </Button>
      {overview.receipts.length === 0 ? <p className="text-sm text-muted-foreground">No receipts stored yet.</p> : null}
      {overview.receipts.map(receipt => (
        <ShopSection key={receipt.id} title={`${when(receipt.purchasedAt)} ${receipt.storeLabel ?? ''}`} subtitle={`Status: ${receipt.status.replaceAll('_', ' ')}${receipt.totalCents !== null ? ` · total ${money(receipt.totalCents)}` : ''}`}>
          {receipt.lines.length === 0 ? <p className="text-xs text-muted-foreground">Bought before receipt processing was enabled; kept as a header only.</p> : (
            <ShopTable headers={['Line', 'Qty', 'Amount', 'Status', 'Attribution']}>
                {receipt.lines.map(line => (
                  <TableRow key={line.id}>
                    <ShopCell label="Line">{line.description}</ShopCell>
                    <ShopCell label="Qty">{line.quantity} {line.unit}</ShopCell>
                    <ShopCell label="Amount">{money(line.amountCents)}</ShopCell>
                    <ShopCell label="Status">{line.status}{line.reviewReason ? ` (${REVIEW_LABELS[line.reviewReason] ?? line.reviewReason})` : ''}</ShopCell>
                    <ShopCell label="Attribution"><span className="text-xs text-muted-foreground">
                      {line.links.map(link => `${link.kind} ${Math.round(link.baseAmount * 1000) / 1000}`).join(', ')}
                    </span></ShopCell>
                  </TableRow>
                ))}
            </ShopTable>
          )}
        </ShopSection>
      ))}
    </div>
  );
}

function ReviewTab({ overview, reload }: { overview: ShopOverview; reload: () => Promise<void> }) {
  return (
    <div className="space-y-4">
      <ShopSection title="Receipt lines to review" subtitle="Nothing here was booked. Map the product, confirm a one-off substitution, or dismiss the line.">
        {overview.review.length === 0 ? <p className="text-sm text-muted-foreground">Nothing to review.</p> : (
          <ul className="space-y-3">
            {overview.review.map(line => <ReviewLine key={line.id} line={line} overview={overview} reload={reload} />)}
          </ul>
        )}
      </ShopSection>

      <ShopSection title="Stock discrepancies" subtitle="A manual check booked something that differs from what the receipt shows.">
        {overview.discrepancies.length === 0 ? <p className="text-sm text-muted-foreground">No open discrepancies.</p> : (
          <ul className="space-y-3">
            {overview.discrepancies.map(discrepancy => <DiscrepancyItem key={discrepancy.id} discrepancy={discrepancy} reload={reload} />)}
          </ul>
        )}
      </ShopSection>

      <ShopSection title="Writes needing a decision" subtitle="These writes have an unknown outcome or failed. They are never retried automatically.">
        {overview.effects.length === 0 ? <p className="text-sm text-muted-foreground">All writes are settled.</p> : (
          <ul className="space-y-2">
            {overview.effects.map(effect => (
              <li key={effect.id} className="space-y-1 rounded-md border border-border bg-muted/20 p-3 text-sm" data-testid="uncertain-effect">
                <div>
                  <span className="font-semibold">{String((effect.payload as { label?: string }).label ?? effect.kind)}</span>{' '}
                  <AppBadge small tone={effect.status === 'unknown' ? 'warning' : 'error'}>{effect.status.replace('_', ' ')}</AppBadge>{' '}
                  <span className="text-xs text-muted-foreground">{effect.kind} · {effect.sourceKind} · attempts {effect.attempts}</span>
                </div>
                {effect.error ? <div className="text-xs text-muted-foreground">Last error: {effect.error}</div> : null}
                {effect.evidence ? <pre className="overflow-x-auto rounded bg-bg-3/60 p-1 text-[11px]">{JSON.stringify(effect.evidence, null, 1)}</pre> : null}
                <div className="flex flex-wrap gap-2">
                  {effect.status === 'unknown' ? (
                    <>
                      <Button size="sm" variant="outline" onClick={async () => { if (await post(`/api/shop/effects/${effect.id}`, { action: 'booked_elsewhere' }, 'Marked as done')) await reload(); }}>It happened</Button>
                      <Button size="sm" variant="outline" onClick={async () => { if (await post(`/api/shop/effects/${effect.id}`, { action: 'not_booked_retry' }, 'Will retry once')) await reload(); }}>It did not happen, retry</Button>
                    </>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={async () => { if (await post(`/api/shop/effects/${effect.id}`, { action: 'skip' }, 'Skipped')) await reload(); }}>Skip</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ShopSection>
    </div>
  );
}

function ReviewLine({ line, overview, reload }: { line: ShopOverview['review'][number]; overview: ShopOverview; reload: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<TargetOption[]>([]);
  const [productId, setProductId] = useState('');
  const [stockAmount, setStockAmount] = useState('');
  const [rows, setRows] = useState<string[]>([]);
  const [checks, setChecks] = useState<string[]>([]);
  const [remember, setRemember] = useState(false);
  const [fulfilOnly, setFulfilOnly] = useState(false);

  async function loadTargets() {
    try {
      const result = await apiJson<{ targets: TargetOption[] }>(`/api/shop/targets?query=${encodeURIComponent(line.description)}`);
      setTargets(result.targets.filter(target => target.kind === 'grocy_product'));
    } catch (error) {
      toast.error('Search failed', { description: (error as Error).message });
    }
  }

  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter(entry => entry !== value) : [...list, value]);
  const selectedProduct = targets.find(target => target.id === productId);

  return (
    <li className="space-y-2 rounded-md border border-border bg-muted/20 p-3 text-sm" data-testid="review-line">
      <div>
        <span className="font-semibold">{line.description}</span> · {line.quantity} {line.unit} {line.amountCents !== null ? `· ${money(line.amountCents)}` : ''} ·{' '}
        <span className="text-muted-foreground">{REVIEW_LABELS[line.reviewReason ?? ''] ?? line.reviewReason}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => { setOpen(!open); if (!open) void loadTargets(); }}>One-off substitution</Button>
        <Button size="sm" variant="outline" onClick={async () => { if (await post(`/api/shop/review/${line.id}`, { action: 'requeue' }, 'Line will be processed again')) await reload(); }}>Process again (after mapping)</Button>
        <Button size="sm" variant="ghost" onClick={async () => { if (await post(`/api/shop/review/${line.id}`, { action: 'dismiss' }, 'Line dismissed')) await reload(); }}>Dismiss</Button>
      </div>
      {open ? (
        <div className="space-y-2 rounded bg-bg-3/40 p-2">
          <label className="flex items-center gap-2"><input type="checkbox" checked={fulfilOnly} onChange={event => setFulfilOnly(event.target.checked)} /> Fulfil demand only, book nothing in Grocy</label>
          {!fulfilOnly ? (
            <div className="flex flex-wrap items-center gap-2">
              <SearchableSelect className="w-full sm:w-64" ariaLabel="Product actually bought" placeholder="Grocy product actually bought…" value={productId || null} onChange={value => setProductId(value ?? '')} options={targets.map(target => ({ value: target.id, label: `${target.name} (${target.baseUnitName ?? 'stock unit'})` }))} />
              <AppInput className="w-28" value={stockAmount} onChange={event => setStockAmount(event.target.value)} placeholder="Stock amount" inputMode="decimal" aria-label="Stock amount" />
              <label className="flex items-center gap-1"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} /> Remember as alternative</label>
            </div>
          ) : null}
          <div>
            <p className="text-xs text-muted-foreground">Open shopping rows this purchase fulfils (they are removed):</p>
            {overview.openDemand.map(row => (
              <label key={row.mealieItemId} className="mr-3 inline-flex items-center gap-1">
                <input type="checkbox" checked={rows.includes(row.mealieItemId)} onChange={() => setRows(toggle(rows, row.mealieItemId))} /> {row.label} ({row.quantity})
              </label>
            ))}
          </div>
          {overview.recentChecks.length > 0 ? (
            <div>
              <p className="text-xs text-muted-foreground">Rows you already checked off for this purchase (their original booking is flagged for review):</p>
              {overview.recentChecks.slice(0, 15).map(check => (
                <label key={check.id} className="mr-3 inline-flex items-center gap-1">
                  <input type="checkbox" checked={checks.includes(check.id)} onChange={() => setChecks(toggle(checks, check.id))} /> product #{check.grocyProductId} · {when(check.checkedObservedAt)}
                </label>
              ))}
            </div>
          ) : null}
          <Button
            size="sm"
            disabled={!fulfilOnly && (!productId || !(Number(stockAmount) > 0))}
            onClick={async () => {
              const body = {
                action: 'substitute',
                bookGrocyProductId: fulfilOnly ? null : Number(productId),
                bookGrocyProductName: fulfilOnly ? undefined : selectedProduct?.name,
                stockAmount: fulfilOnly ? null : Number(stockAmount),
                mealieItemIds: rows,
                lifecycleIds: checks,
                rememberAsAlternative: !fulfilOnly && remember,
              };
              if (await post(`/api/shop/review/${line.id}`, body, 'Substitution confirmed')) await reload();
            }}
          >
            Confirm substitution
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function DiscrepancyItem({ discrepancy, reload }: { discrepancy: ShopOverview['discrepancies'][number]; reload: () => Promise<void> }) {
  const evidence = (discrepancy.evidence ?? {}) as {
    bookedAmount?: number;
    receiptAmount?: number;
    productId?: number;
    bookings?: Array<{ productId: number; amount: number; transactionId: string | null }>;
    receiptLine?: { description?: string };
  };
  const [amount, setAmount] = useState(
    evidence.bookedAmount !== undefined && evidence.receiptAmount !== undefined ? String(Math.max(0, evidence.bookedAmount - evidence.receiptAmount)) : '',
  );
  const productId = evidence.productId ?? evidence.bookings?.[0]?.productId;
  if (discrepancy.kind === 'check_after_receipt') {
    return (
      <li className="space-y-2 rounded-md border border-border bg-muted/20 p-3 text-sm" data-testid="discrepancy">
        <div className="font-semibold">A shopping row was checked off while a receipt was already fulfilling it. Nothing was booked for the check yet.</div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={async () => {
            if (await post(`/api/shop/discrepancies/${discrepancy.id}`, { action: 'skip_check' }, 'The receipt covers it; the check books nothing')) await reload();
          }}>The receipt covers it</Button>
          <Button size="sm" variant="outline" onClick={async () => {
            if (await post(`/api/shop/discrepancies/${discrepancy.id}`, { action: 'book_check' }, 'The check will be booked as an extra purchase')) await reload();
          }}>It was an additional purchase, book it</Button>
        </div>
      </li>
    );
  }
  return (
    <li className="space-y-2 rounded-md border border-border bg-muted/20 p-3 text-sm" data-testid="discrepancy">
      <div className="font-semibold">
        {discrepancy.kind === 'over_booked_manual_check'
          ? `A manual check booked ${evidence.bookedAmount}, the receipt shows ${evidence.receiptAmount}.`
          : `A substitute was bought, but the original product was already booked${evidence.receiptLine?.description ? ` (${evidence.receiptLine.description})` : ''}.`}
      </div>
      <pre className="overflow-x-auto rounded bg-bg-3/60 p-1 text-[11px]">{JSON.stringify(evidence.bookings ?? [], null, 1)}</pre>
      <div className="flex flex-wrap items-center gap-2">
        {(evidence.bookings ?? []).filter(booking => booking.transactionId).map(booking => (
          <Button key={booking.transactionId} size="sm" variant="outline" onClick={async () => {
            if (await post(`/api/shop/discrepancies/${discrepancy.id}`, { action: 'undo_transaction', transactionId: booking.transactionId }, 'Booking undone')) await reload();
          }}>Undo booking {booking.transactionId}</Button>
        ))}
        {productId ? (
          <>
            <AppInput className="w-20" value={amount} onChange={event => setAmount(event.target.value)} inputMode="decimal" aria-label="Amount to consume" />
            <Button size="sm" variant="outline" disabled={!(Number(amount) > 0)} onClick={async () => {
              if (await post(`/api/shop/discrepancies/${discrepancy.id}`, { action: 'consume_difference', productId, amount: Number(amount) }, 'Difference consumed')) await reload();
            }}>Consume difference</Button>
          </>
        ) : null}
        <Button size="sm" variant="ghost" onClick={async () => { if (await post(`/api/shop/discrepancies/${discrepancy.id}`, { action: 'keep_stock' }, 'Stock kept as is')) await reload(); }}>Keep stock as is</Button>
      </div>
    </li>
  );
}

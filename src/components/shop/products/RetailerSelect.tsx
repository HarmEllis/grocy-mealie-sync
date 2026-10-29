'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import type { TargetOption } from '@/lib/shop/targets';
import { apiJson } from '../api';
import { catalogOptions, productLabel, type ShopProduct } from '../catalog-options';
import { forTarget, type Provider, type Suggestion } from './types';

/** A closed row never calls the plugin. Known products are shown immediately on opening. */
export function RetailerSelect({ provider, products, target, value, selectedName, suggestions, onChoose, onCatalog }: {
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

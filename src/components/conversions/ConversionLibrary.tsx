'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight, CircleAlert, Droplets, Link2, Loader2, Plus, RefreshCw, Scale, Search, Sparkles, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { AppBadge } from '@/components/redesign/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatFactor, type getConversionLibrary } from '@/lib/conversions/catalog';
import type { ImportPreview, ImportResult, ImportSelection, PlanStatus } from '@/lib/conversions/contracts';
import type { ListConversionsResult, ConversionEntry } from '@/lib/use-cases/conversions/manage';
import type { UnitCatalogResource } from '@/lib/use-cases/units/manage';

interface InstalledData extends ListConversionsResult { units: UnitCatalogResource; products: Array<{ id: number; name: string }> }
const selectClass = 'h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm text-text-1 outline-none focus-visible:ring-2 focus-visible:ring-ring';

class ConversionApiError extends Error {
  constructor(message: string, public readonly body: { code?: string; preview?: ImportPreview }) { super(message); }
}

async function api<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(path, body === undefined && method === 'POST' ? { cache: 'no-store' } : { method, headers: { 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new ConversionApiError(data.error ?? 'The request could not be completed.', data);
  return data;
}

function StatusBadge({ status }: { status: PlanStatus }) {
  const labels = { ready: 'Ready to add', already_available: 'In Grocy', needs_unit_selection: 'Choose units', conflict: 'Factor conflict' };
  return <AppBadge small tone={status === 'already_available' ? 'success' : status === 'conflict' ? 'error' : status === 'needs_unit_selection' ? 'warning' : 'accent'}>
    {status === 'already_available' ? <Check className="size-3" /> : null}{labels[status]}
  </AppBadge>;
}

export function ConversionLibrary({ catalog }: { catalog: ReturnType<typeof getConversionLibrary> }) {
  const [tab, setTab] = useState<'library' | 'installed'>('library');
  const [query, setQuery] = useState('');
  const [system, setSystem] = useState<'all' | 'metric' | 'us'>('all');
  const [dimension, setDimension] = useState<'all' | 'mass' | 'volume'>('all');
  const [target, setTarget] = useState<'both' | 'grocy'>('both');
  const [createMissing, setCreateMissing] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [bindings, setBindings] = useState<ImportSelection['bindings']>({});
  const [coverage, setCoverage] = useState<ImportPreview | null>(null);
  const [installed, setInstalled] = useState<InstalledData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [reviewError, setReviewError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState({ from: '', to: '', factor: '1', product: '' });
  const [deleteEntry, setDeleteEntry] = useState<ConversionEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const results = await Promise.allSettled([
      api<InstalledData>(`/api/conversions?target=${target}`),
      api<ImportPreview>('/api/conversions/preview', { entryIds: catalog.entries.map(e => e.id), target, createMissingUnits: true }),
    ]);
    if (results[0].status === 'fulfilled') setInstalled(results[0].value);
    if (results[1].status === 'fulfilled') setCoverage(results[1].value);
    const failure = results.find(r => r.status === 'rejected');
    if (failure?.status === 'rejected') setError(failure.reason instanceof Error ? failure.reason.message : 'Could not load your unit setup.');
    setLoading(false);
  }, [catalog.entries, target]);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => catalog.entries.filter(e => (system === 'all' || e.from.system === system)
    && (dimension === 'all' || e.from.dimension === dimension)
    && `${e.equation} ${e.from.aliases.join(' ')} ${e.to.aliases.join(' ')}`.toLowerCase().includes(query.toLowerCase())), [catalog.entries, system, dimension, query]);
  const relationships = useMemo(() => {
    const seen = new Set<string>();
    return (installed?.conversions ?? []).filter(c => {
      const key = `${c.grocyProductId ?? 'global'}:${Math.min(c.fromUnitId, c.toUnitId)}:${Math.max(c.fromUnitId, c.toUnitId)}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }, [installed]);
  const visibleInstalled = relationships.filter(c => `${c.fromUnitName} ${c.toUnitName} ${c.grocyProductId ?? ''}`.toLowerCase().includes(query.toLowerCase()));

  function toggle(id: string) { setSelected(previous => previous.includes(id) ? previous.filter(x => x !== id) : [...previous, id]); setResult(null); }
  function selectPreset(preset: 'metric' | 'us') {
    setSystem(preset); setQuery(''); setDimension('all'); setTab('library');
    setSelected(catalog.entries.filter(e => e.from.system === preset).map(e => e.id));
    setBindings({}); setResult(null);
  }
  async function review(nextBindings = bindings) {
    setReviewOpen(true); setBusy(true); setReviewError(''); setPreview(null);
    try {
      const required = new Set(catalog.entries.filter(e => selected.includes(e.id)).flatMap(e => [e.from.id, e.to.id]));
      const currentBindings = Object.fromEntries(Object.entries(nextBindings).filter(([id]) => required.has(id)));
      const next = await api<ImportPreview>('/api/conversions/preview', { entryIds: selected, target, createMissingUnits: createMissing, bindings: currentBindings });
      setPreview(next);
    } catch (err) { setReviewError(err instanceof Error ? err.message : 'Could not preview the import.'); }
    finally { setBusy(false); }
  }
  function bind(unitId: string, field: 'mealieUnitId' | 'grocyUnitId', value: string) {
    const createField = field === 'mealieUnitId' ? 'createMealie' : 'createGrocy';
    const entry = { ...bindings[unitId] };
    delete entry[field]; delete entry[createField];
    if (value === 'create') entry[createField] = true;
    else if (value) {
      if (field === 'grocyUnitId') entry.grocyUnitId = Number(value);
      else entry.mealieUnitId = value;
    }
    const next = { ...bindings, [unitId]: entry }; setBindings(next); void review(next);
  }
  function rename(unitId: string, field: 'name' | 'pluralName', value: string) {
    const name = value.trim();
    if (!name || name === preview?.units.find(unit => unit.unit.id === unitId)?.[field]) return;
    const next = { ...bindings, [unitId]: { ...bindings[unitId], [field]: name } };
    setBindings(next); void review(next);
  }
  async function applyImport() {
    if (!preview?.canImport) return;
    setBusy(true); setReviewError('');
    try {
      const data = await api<ImportResult>('/api/conversions/import', { ...preview.selection, fingerprint: preview.fingerprint });
      setResult(data); setReviewOpen(false);
      if (data.failed) {
        const next = { ...bindings };
        for (const step of data.steps) {
          if (step.kind !== 'unit' || step.status !== 'created' || !step.id) continue;
          const binding = { ...next[step.unitId] };
          if (step.system === 'Mealie') { delete binding.createMealie; binding.mealieUnitId = String(step.id); }
          if (step.system === 'Grocy') { delete binding.createGrocy; binding.grocyUnitId = Number(step.id); }
          next[step.unitId] = binding;
        }
        setBindings(next);
        toast.warning(`${data.created} changes completed. ${data.failed} steps need attention.`);
      }
      else { toast.success(data.created ? 'Your shared unit setup is ready.' : 'Everything is already set up.'); setSelected([]); setBindings({}); }
      await load();
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Import failed.');
      const next = err instanceof ConversionApiError && (err.body.code === 'PREVIEW_STALE' || err.body.code === 'IMPORT_BLOCKED') ? err.body.preview : undefined;
      setPreview(next ?? null);
      if (next) setBindings(next.selection.bindings);
    }
    finally { setBusy(false); }
  }
  async function createCustom() {
    setBusy(true); setReviewError('');
    try {
      const data = await api<{ created: boolean }>('/api/conversions', { fromGrocyUnitId: Number(custom.from), toGrocyUnitId: Number(custom.to), factor: Number(custom.factor), ...(custom.product ? { grocyProductId: Number(custom.product) } : {}) });
      toast.success(data.created ? 'Custom conversion created.' : 'This conversion already exists.'); setCustomOpen(false); await load();
    } catch (err) { setReviewError(err instanceof Error ? err.message : 'Could not create the conversion.'); }
    finally { setBusy(false); }
  }
  async function removeConversion() {
    if (!deleteEntry) return;
    setBusy(true); setReviewError('');
    try { await api(`/api/conversions/${deleteEntry.id}`, undefined, 'DELETE'); setDeleteEntry(null); toast.success('Conversion removed.'); await load(); }
    catch (err) { setReviewError(err instanceof Error ? err.message : 'Could not delete the conversion.'); }
    finally { setBusy(false); }
  }

  const actionable = preview ? preview.counts.units + preview.counts.standardizations + preview.counts.mappings + preview.counts.conversions : 0;
  return <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-28 lg:pb-20">
    <div className="flex items-start justify-between gap-3">
      <PageHeader title="Units & conversions" subtitle="Give Mealie and Grocy a shared understanding of your measurements." />
      <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading || busy} aria-label="Refresh unit setup"><RefreshCw className={cn('size-4', loading && 'animate-spin')} /></Button>
    </div>

    <section className="relative isolate overflow-hidden rounded-2xl border border-primary/20 bg-[linear-gradient(120deg,var(--accent-subtle),var(--card))] p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full bg-primary/8 blur-3xl" aria-hidden="true" />
      <div className="relative grid items-center gap-6 md:grid-cols-[1fr_310px]">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"><Sparkles className="size-3.5" /> A shared measurement library</div>
          <h2 className="max-w-lg text-2xl font-extrabold tracking-tight sm:text-3xl">Make your units<br className="hidden sm:block" /> work together.</h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-text-2">Choose a preset, connect your existing units, and review the changes. Set up Mealie measurements and Grocy conversions in one place.</p>
          <div className="mt-5 flex flex-wrap items-center gap-2"><AppBadge tone="accent"><BookOpen className="size-3" /> {catalog.entries.length} verified definitions</AppBadge><AppBadge><Link2 className="size-3" /> {installed?.units.counts.mappedUnits ?? '—'} linked units</AppBadge></div>
        </div>
        <div className="rounded-xl border border-border bg-background/70 p-5 shadow-lg shadow-primary/5">
          <div className="mb-4 flex items-center justify-between text-xs font-semibold text-text-3"><span>ONE MEASUREMENT</span><ArrowLeftRight className="size-4 text-primary" /></div>
          <div className="flex items-baseline justify-between gap-3 font-mono"><span className="text-3xl font-bold">1<span className="ml-2 text-base text-text-2">kg</span></span><span className="text-xl text-text-3">=</span><span className="text-3xl font-bold text-primary">1,000<span className="ml-2 text-base text-text-2">g</span></span></div>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4">{['Mealie standard', 'Grocy conversion'].map(label => <div key={label} className="flex items-center gap-1.5 text-xs text-text-2"><CheckCircle2 className="size-3.5 text-primary" />{label}</div>)}</div>
        </div>
      </div>
    </section>

    {error ? <div role="alert" className="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/8 p-4 text-sm"><CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" /><div><p className="font-semibold">Your setup could not be fully loaded</p><p className="mt-1 text-text-2">{error}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>Try again</Button></div></div> : null}

    {result ? <section aria-live="polite" className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-bold">{result.failed ? <CircleAlert className="size-5 text-warning" /> : <CheckCircle2 className="size-5 text-success" />}{result.failed ? 'Some steps need attention' : 'Your units are set up'}<AppBadge tone={result.failed ? 'warning' : 'success'}>{result.created} changes</AppBadge></h2><Button variant="ghost" size="icon-sm" onClick={() => setResult(null)} aria-label="Dismiss import results"><X className="size-4" /></Button></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{result.steps.map((step, i) => <div key={i} className={cn('flex items-start gap-2 rounded-lg p-3 text-xs', step.status === 'failed' ? 'bg-warning/10' : 'bg-bg-2/50')}>
        {step.status === 'failed' ? <CircleAlert className="size-4 shrink-0 text-warning" /> : <Check className="size-4 shrink-0 text-success" />}<div><p className="font-semibold">{step.system} · {step.kind}</p><p className="mt-1 text-text-2">{step.message}</p></div>
      </div>)}</div>
      {result.failed && selected.length ? <Button className="mt-4" variant="outline" onClick={() => void review()}>Review remaining steps</Button> : null}
    </section> : null}

    <div className="flex items-center justify-between gap-3 border-b border-border">
      <div role="tablist" aria-label="Conversion views" className="flex gap-5">{(['library', 'installed'] as const).map(value => <button key={value} role="tab" id={`${value}-tab`} aria-selected={tab === value} aria-controls={`${value}-panel`} onClick={() => { setTab(value); setQuery(''); }} className={cn('flex items-center gap-2 border-b-2 px-1 pb-3 pt-1 text-sm font-bold transition-colors', tab === value ? 'border-primary text-primary' : 'border-transparent text-text-3 hover:text-text-1')}>
        {value === 'library' ? <BookOpen className="size-4" /> : <CheckCircle2 className="size-4" />}{value === 'library' ? 'Library' : 'Installed'}<span className="rounded-md bg-bg-3/60 px-1.5 py-0.5 text-[11px]">{value === 'library' ? catalog.entries.length : relationships.length}</span>
      </button>)}</div>
      {tab === 'installed' ? <Button variant="outline" size="sm" onClick={() => { setReviewError(''); setCustomOpen(true); }}><Plus className="size-3.5" /><span className="hidden sm:inline">Custom conversion</span><span className="sm:hidden">Custom</span></Button> : null}
    </div>

    {tab === 'library' ? <div role="tabpanel" id="library-panel" aria-labelledby="library-tab" className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">{catalog.presets.map(preset => <button key={preset.id} onClick={() => selectPreset(preset.id as 'metric' | 'us')} className={cn('group flex items-start gap-4 rounded-xl border p-5 text-left transition-all hover:border-primary/50 hover:shadow-md hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', system === preset.id ? 'border-primary/40 bg-accent-subtle' : 'border-border bg-card')}>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{preset.id === 'metric' ? <Scale className="size-5" /> : <Droplets className="size-5" />}</span>
        <span className="flex-1"><span className="block text-sm font-bold">{preset.name}</span><span className="mt-1 block text-xs leading-relaxed text-text-2">{preset.description}</span><span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">Select {catalog.entries.filter(e => e.from.system === preset.id).length} definitions <ChevronRight className="size-3" /></span></span>
      </button>)}</div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"><div className="flex items-center gap-2 text-xs font-semibold text-text-2"><Link2 className="size-4 text-primary" /> Set up in</div>
        <select aria-label="Import target" value={target} onChange={e => { setTarget(e.target.value as 'both' | 'grocy'); setBindings({}); }} className={cn(selectClass, 'w-auto flex-1 sm:flex-none')}><option value="both">Mealie + Grocy</option><option value="grocy">Grocy only</option></select>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-text-2 sm:ml-auto"><Checkbox checked={createMissing} onCheckedChange={value => setCreateMissing(Boolean(value))} />Create missing units</label>
      </div>
      <div className="flex flex-wrap items-center gap-2"><div className="relative min-w-44 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" /><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search units or conversions…" aria-label="Search conversions" className="h-10 pl-9" /></div>
        <select aria-label="Measurement system" value={system} onChange={e => setSystem(e.target.value as typeof system)} className={cn(selectClass, 'w-auto')}><option value="all">All systems</option><option value="metric">Metric</option><option value="us">US customary</option></select>
        <select aria-label="Measurement type" value={dimension} onChange={e => setDimension(e.target.value as typeof dimension)} className={cn(selectClass, 'w-auto')}><option value="all">Mass + volume</option><option value="mass">Mass</option><option value="volume">Volume</option></select>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border bg-bg-2/40 px-4 py-3 text-xs text-text-3"><Checkbox aria-label="Select visible conversions" checked={rows.length > 0 && rows.every(e => selected.includes(e.id))} onCheckedChange={value => { setSelected(previous => value ? [...new Set([...previous, ...rows.map(e => e.id)])] : previous.filter(id => !rows.some(e => e.id === id))); setResult(null); }} /><span className="font-semibold">{rows.length} definitions</span><span className="ml-auto hidden sm:block">Preview checks your existing setup</span></div>
        {rows.length === 0 ? <div className="py-14 text-center"><Search className="mx-auto size-7 text-text-3" /><p className="mt-3 text-sm font-semibold">No matching conversions</p><p className="mt-1 text-xs text-text-3">Try another unit name or clear your filters.</p></div> : rows.map(entry => {
          const entryCoverage = coverage?.entries.find(e => e.entry.id === entry.id);
          return <div key={entry.id} className={cn('flex items-center gap-3 border-b border-border/60 px-4 py-4 transition-colors last:border-0 sm:gap-4 sm:px-5', selected.includes(entry.id) && 'bg-primary/4')}>
            <Checkbox aria-label={`Select ${entry.from.name}`} checked={selected.includes(entry.id)} onCheckedChange={() => toggle(entry.id)} />
            <div className={cn('hidden size-9 shrink-0 items-center justify-center rounded-lg sm:flex', entry.from.dimension === 'mass' ? 'bg-primary/10 text-primary' : 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)]')}>{entry.from.dimension === 'mass' ? <Scale className="size-4" /> : <Droplets className="size-4" />}</div>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="text-sm font-bold">{entry.from.name}</span><span className="text-[10px] font-semibold uppercase tracking-wider text-text-3">{entry.from.system === 'us' ? 'US customary' : 'Metric'}</span></div><p className="mt-1.5 font-mono text-xs text-text-2">1 {entry.from.abbreviation} <span className="px-1 text-text-3">=</span> <span className="font-semibold text-text-1">{formatFactor(entry.factor)}</span> {entry.to.abbreviation}</p></div>
            <div className="text-right">{loading ? <span className="text-xs text-text-3">Checking…</span> : entryCoverage ? <StatusBadge status={entryCoverage.status} /> : <span className="text-xs text-text-3">Preview to check</span>}<p className="mt-1.5 hidden text-[11px] text-text-3 sm:block">{entry.from.dimension === 'mass' ? 'Mass' : 'Volume'} conversion</p></div>
          </div>;
        })}
      </div>
      <p className="text-xs leading-relaxed text-text-3">Factors keep their full precision when imported. Grocy supplies inverse and indirect conversions automatically. <a href={catalog.source} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">Measurement reference</a></p>
    </div> : <div role="tabpanel" id="installed-panel" aria-labelledby="installed-tab" className="flex flex-col gap-4">
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" /><Input aria-label="Search installed conversions" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find an installed conversion…" className="h-10 pl-9" /></div>
      {loading ? <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-primary" /></div> : !visibleInstalled.length ? <div className="rounded-xl border border-dashed border-border p-12 text-center"><ArrowLeftRight className="mx-auto size-9 text-text-3" /><h2 className="mt-4 font-bold">{query ? 'No matching conversions' : 'Start with your first conversion'}</h2><p className="mt-2 text-sm text-text-2">{query ? 'Try a different unit name.' : 'Choose a library preset or add your own product-specific relationship.'}</p>{!query ? <Button variant="outline" className="mt-5" onClick={() => setTab('library')}>Explore the library <ArrowRight className="size-4" /></Button> : null}</div> : <div className="grid gap-3 sm:grid-cols-2">{visibleInstalled.map(entry => <div key={entry.id} className="rounded-xl border border-border bg-card p-5"><div className="flex items-center justify-between gap-2"><AppBadge small tone={entry.grocyProductId ? 'accent' : 'default'}>{entry.grocyProductId ? (installed?.products.find(p => p.id === entry.grocyProductId)?.name ?? `Product #${entry.grocyProductId}`) : 'All products'}</AppBadge><Button variant="ghost" size="icon-sm" aria-label={`Delete ${entry.fromUnitName} to ${entry.toUnitName}`} onClick={() => { setReviewError(''); setDeleteEntry(entry); }}><Trash2 className="size-3.5 text-text-3" /></Button></div><p className="mt-4 text-sm font-bold">1 {entry.fromUnitName} <span className="mx-1 font-normal text-text-3">=</span> {formatFactor(entry.factor)} {entry.toUnitName}</p><p className="mt-2 text-xs text-text-3">Inverse available · Managed in Grocy</p></div>)}</div>}
    </div>}

    {selected.length && tab === 'library' ? <div className="sticky bottom-20 z-20 -mt-1 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-card/95 px-4 py-3 shadow-xl shadow-black/10 backdrop-blur-md lg:bottom-3">
      <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 font-mono text-sm font-bold text-primary">{selected.length}</span><div><p className="text-sm font-bold">Definitions selected</p><button className="mt-0.5 text-xs text-text-3 underline underline-offset-2" onClick={() => { setSelected([]); setBindings({}); }}>Clear selection</button></div></div>
      <Button onClick={() => void review()} disabled={busy}><ArrowDownToLine className="size-4" />Review import</Button>
    </div> : null}

    <Dialog open={reviewOpen} onOpenChange={open => { if (!busy) setReviewOpen(open); }}>
      <DialogContent className="max-h-[85dvh] gap-0 overflow-y-auto sm:max-w-2xl" showCloseButton={!busy}>
        <DialogHeader className="pb-5"><DialogTitle className="flex items-center gap-2 text-lg font-bold"><ArrowDownToLine className="size-5 text-primary" />Review your shared unit setup</DialogTitle><DialogDescription>Check the units and proposed changes before importing into {target === 'both' ? 'Mealie and Grocy' : 'Grocy'}.</DialogDescription></DialogHeader>
        {reviewError ? <div role="alert" className="mb-4 rounded-lg bg-warning/10 p-3 text-sm text-warning">{reviewError}</div> : null}
        {busy && !preview ? <div className="flex items-center justify-center gap-2 py-14 text-sm text-text-2"><Loader2 className="size-5 animate-spin text-primary" />Checking your current setup…</div> : null}
        {preview ? <>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[[preview.counts.units, 'New units'], [preview.counts.standardizations, 'Mealie standards'], [preview.counts.mappings, 'Unit links'], [preview.counts.conversions, 'Conversions']].map(([count, label]) => <div key={label} className="rounded-lg bg-bg-2 p-3"><p className="font-mono text-xl font-bold text-primary">{count}</p><p className="mt-1 text-[11px] text-text-3">{label}</p></div>)}</div>
          <div className="flex flex-col gap-3">{preview.units.map(plan => <div key={plan.unit.id} className={cn('rounded-xl border p-4', plan.problems.length ? 'border-warning/30 bg-warning/4' : 'border-border')}>
            <div className="mb-3 flex items-center justify-between gap-2"><p className="text-sm font-bold">{plan.unit.name}</p><span className="font-mono text-xs text-text-3">{formatFactor(plan.unit.scale)} {plan.unit.standardUnit === 'gram' ? 'g' : 'mL'}</span></div>
            <div className={cn('grid gap-3', target === 'both' && 'sm:grid-cols-2')}>
              {target === 'both' ? <label className="min-w-0 text-xs font-semibold text-text-2">Mealie<select className={cn(selectClass, 'mt-1.5')} aria-label={`Mealie unit for ${plan.unit.name}`} disabled={busy} value={bindings[plan.unit.id]?.createMealie ? 'create' : plan.mealie?.id ?? (plan.mealieCandidates.length ? '' : 'create')} onChange={e => bind(plan.unit.id, 'mealieUnitId', e.target.value)}><option value="">Choose a unit…</option><option value="create" disabled={!createMissing}>Create {plan.name}</option>{(installed?.units.mealieUnits ?? plan.mealieCandidates).map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select><span className="mt-1.5 block text-[11px] font-normal text-text-3">{plan.createMealie ? 'Create with its standard measure' : plan.standardizeMealie ? 'Fill missing standard measure' : 'Keep existing definition'}</span></label> : null}
              <label className="min-w-0 text-xs font-semibold text-text-2">Grocy<select className={cn(selectClass, 'mt-1.5')} aria-label={`Grocy unit for ${plan.unit.name}`} disabled={busy} value={bindings[plan.unit.id]?.createGrocy ? 'create' : plan.grocy?.id ?? (plan.grocyCandidates.length ? '' : 'create')} onChange={e => bind(plan.unit.id, 'grocyUnitId', e.target.value)}><option value="">Choose a unit…</option><option value="create" disabled={!createMissing}>Create {plan.name}</option>{(installed?.units.grocyUnits ?? plan.grocyCandidates).map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select><span className="mt-1.5 block text-[11px] font-normal text-text-3">{plan.createGrocy ? 'Create a new quantity unit' : 'Reuse this quantity unit'}{plan.createMapping && target === 'both' ? ' · Link to Mealie' : ''}</span></label>
            </div>
            {(plan.createMealie || plan.createGrocy) ? <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-text-2">New unit name<Input key={`${plan.unit.id}:${plan.name}`} className="mt-1.5 h-9" aria-label={`New name for ${plan.unit.name}`} defaultValue={plan.name} disabled={busy} onBlur={e => rename(plan.unit.id, 'name', e.target.value)} /></label>
              <label className="block text-xs font-semibold text-text-2">Plural name<Input key={`${plan.unit.id}:${plan.pluralName}`} className="mt-1.5 h-9" aria-label={`Plural name for ${plan.unit.name}`} defaultValue={plan.pluralName} disabled={busy} onBlur={e => rename(plan.unit.id, 'pluralName', e.target.value)} /></label>
            </div> : null}
            {plan.problems.length ? <p className="mt-3 text-xs leading-relaxed text-warning">{plan.problems.join(' ')}</p> : null}
          </div>)}</div>
          <div className="my-4 rounded-lg border border-border bg-bg-2/40 p-3">{preview.entries.map(item => <div key={item.entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"><span className="font-mono">{item.entry.equation}</span><StatusBadge status={item.status} />{item.status === 'conflict' ? <p className="w-full text-warning">{item.message}{item.existingFactor !== undefined ? ` Existing factor: ${formatFactor(item.existingFactor)}.` : ''}</p> : null}</div>)}</div>
        </> : null}
        <DialogFooter className="mt-4"><Button variant="outline" disabled={busy} onClick={() => setReviewOpen(false)}>Cancel</Button>{!preview ? <Button disabled={busy} onClick={() => void review()}>Refresh preview</Button> : <Button disabled={busy || !preview.canImport} onClick={() => void applyImport()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{!preview.canImport ? 'Resolve highlighted items' : actionable ? `Apply ${actionable} changes` : 'Already set up'}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={customOpen} onOpenChange={open => { if (!busy) setCustomOpen(open); }}><DialogContent showCloseButton={!busy}><DialogHeader><DialogTitle>Custom conversion</DialogTitle><DialogDescription>Add a Grocy relationship such as one bottle equaling 750 milliliters.</DialogDescription></DialogHeader>
      {reviewError ? <p role="alert" className="text-sm text-warning">{reviewError}</p> : null}
      <div className="grid gap-3">{(['from', 'to'] as const).map(field => <label key={field} className="text-xs font-semibold text-text-2">{field === 'from' ? 'From unit' : 'To unit'}<select aria-label={`${field} unit`} className={cn(selectClass, 'mt-1.5')} value={custom[field]} onChange={e => setCustom({ ...custom, [field]: e.target.value })}><option value="">Choose a Grocy unit…</option>{installed?.units.grocyUnits.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>)}
      <label className="text-xs font-semibold text-text-2">Conversion factor<Input aria-label="Conversion factor" className="mt-1.5" type="number" min="0" step="any" value={custom.factor} onChange={e => setCustom({ ...custom, factor: e.target.value })} /><span className="mt-1 block text-[11px] font-normal text-text-3">1 source unit = this many target units</span></label>
      <label className="text-xs font-semibold text-text-2">Applies to<select aria-label="Product scope" className={cn(selectClass, 'mt-1.5')} value={custom.product} onChange={e => setCustom({ ...custom, product: e.target.value })}><option value="">All products</option>{installed?.products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select><span className="mt-1 block text-[11px] font-normal text-text-3">Choose a product for packaging sizes such as bottles and packs.</span></label></div>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setCustomOpen(false)}>Cancel</Button><Button disabled={busy || !custom.from || !custom.to || custom.from === custom.to || !(Number(custom.factor) > 0)} onClick={() => void createCustom()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Create conversion</Button></DialogFooter>
    </DialogContent></Dialog>

    <Dialog open={Boolean(deleteEntry)} onOpenChange={open => { if (!open && !busy) setDeleteEntry(null); }}><DialogContent showCloseButton={!busy}><DialogHeader><DialogTitle>Remove this conversion?</DialogTitle><DialogDescription>Grocy will also remove its inverse. Products using this relationship may lose the associated unit choices.</DialogDescription></DialogHeader><p className="rounded-lg bg-bg-2 p-3 font-mono text-xs">1 {deleteEntry?.fromUnitName} = {deleteEntry ? formatFactor(deleteEntry.factor) : ''} {deleteEntry?.toUnitName}</p>{reviewError ? <p role="alert" className="text-sm text-warning">{reviewError}</p> : null}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDeleteEntry(null)}>Keep conversion</Button><Button variant="destructive" disabled={busy} onClick={() => void removeConversion()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}Remove conversion</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

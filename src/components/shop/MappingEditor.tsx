'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AppInput } from '@/components/redesign/primitives';
import { ThemedSelect } from '@/components/shared/ThemedSelect';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { apiJson } from './api';
import type { mappingPreview } from '@/lib/shop/mapping-preview';
import type { TargetOption } from '@/lib/shop/targets';

export interface MappingRow {
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
  fulfilsAllDemand?: boolean;
  confirmed: boolean;
}

export interface ProductRow { providerId: string; externalId: string; name: string; packageAmount: number | null; packageUnit: string | null; measure: string }

function targetKey(target: TargetOption): string {
  return `${target.kind}:${target.id}`;
}

function targetLabel(target: TargetOption): string {
  const prefix = target.source === 'grocy_mealie' ? 'G+M' : target.kind === 'grocy_product' ? 'G' : 'M';
  return `(${prefix}) ${target.name}${target.baseUnitName ? ` · ${target.baseUnitName}` : ''}`;
}

export function MappingEditor({ providerId, product, mapping, onClose }: { providerId: string; product: ProductRow; mapping: MappingRow | null; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const dialogTitleRef = useRef<HTMLHeadingElement | null>(null);
  const requestSequence = useRef(0);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof mappingPreview>> | null>(null);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [previewError, setPreviewError] = useState(false);
  const [targets, setTargets] = useState<TargetOption[]>([]);
  const [unitsLoaded, setUnitsLoaded] = useState(false);
  const [unitsError, setUnitsError] = useState(false);
  const [mealieUnits, setMealieUnits] = useState<Array<{ id: string; name: string }>>([]);
  const [selected, setSelected] = useState<TargetOption | null>(mapping && mapping.targetId ? {
    kind: mapping.targetKind as TargetOption['kind'], id: mapping.targetId, name: mapping.targetName,
    baseUnitId: mapping.packageBaseUnitId, baseUnitName: mapping.packageBaseUnitName,
  } : null);
  const unitChosen = useRef(Boolean(mapping?.confirmed) || Boolean(mapping?.packageBaseUnitId));
  const [mealieUnitId, setMealieUnitId] = useState(mapping?.targetKind === 'mealie_food' ? mapping.packageBaseUnitId ?? '' : '');
  const [role, setRole] = useState<'preferred' | 'alternative'>(mapping?.role === 'alternative' ? 'alternative' : 'preferred');
  const [amount, setAmount] = useState(mapping?.packageBaseAmount?.toString() ?? '');
  const [fulfilsAll, setFulfilsAll] = useState(Boolean(mapping?.fulfilsAllDemand));

  useEffect(() => {
    const sequence = ++requestSequence.current;
    setUnitsLoaded(false);
    setUnitsError(false);
    const timer = window.setTimeout(async () => {
      try {
        const result = await apiJson<{ targets: TargetOption[]; mealieUnits: Array<{ id: string; name: string }> }>(`/api/shop/targets?query=${encodeURIComponent(query)}&suggestFor=${encodeURIComponent(product.name.slice(0, 200))}`);
        if (sequence !== requestSequence.current) return;
        setTargets(result.targets);
        setSelected(current => {
          const found = current && result.targets.find(target => targetKey(target) === targetKey(current));
          return current && found ? { ...current, source: found.source, linkedFoods: found.linkedFoods } : current;
        });
        setMealieUnits(result.mealieUnits);
        setUnitsLoaded(true);
      } catch {
        if (sequence === requestSequence.current) setUnitsError(true);
      }
    }, 250);
    return () => { window.clearTimeout(timer); requestSequence.current++; };
  }, [query, product.name]);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    setPreviewError(false);
    if (selected) void apiJson<Awaited<ReturnType<typeof mappingPreview>>>('/api/shop/mappings/preview', {
      method: 'POST', body: JSON.stringify({ providerId, retailerProductId: product.externalId, targetKind: selected.kind, targetId: selected.id, baseUnitId: mealieUnitId || null }),
    }).then(result => {
      if (cancelled) return;
      if (selected.kind === 'mealie_food' && !unitChosen.current && result.suggestedBaseUnit) {
        unitChosen.current = true;
        const suggested = result.suggestedBaseUnit.id ?? '';
        setMealieUnitId(suggested); setAmount('');
        if (suggested !== mealieUnitId) return;
      }
      setPreview(result);
    }).catch(() => { if (!cancelled) setPreviewError(true); });
    return () => { cancelled = true; };
  }, [selected?.kind, selected?.id, mealieUnitId, providerId, product.externalId, previewAttempt]);

  async function save() {
    if (!selected) return;
    if (selected.kind === 'grocy_product' && preview && selected.baseUnitId !== preview.baseUnitId) { toast.error('The Grocy stock unit changed; select the target again and confirm its package amount'); return; }
    if (selected.kind === 'mealie_food' && mealieUnitId && (!unitsLoaded || !mealieUnits.some(unit => unit.id === mealieUnitId))) {
      toast.error(unitsError ? 'Mealie units could not be loaded; try searching again' : unitsLoaded ? 'This Mealie unit is no longer available; choose another unit' : 'Wait for Mealie units to load before saving');
      return;
    }
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
          expectedTargetKey: mapping ? `${mapping.targetKind}:${mapping.targetId}` : undefined,
          reassign: Boolean(mapping && (mapping.targetKind !== selected.kind || mapping.targetId !== selected.id)),
          baseUnitId: baseUnit.id,
          baseUnitName: baseUnit.name,
          packageBaseAmount: parsed,
          fulfilsAllDemand: fulfilsAll,
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
      <DialogContent initialFocus={dialogTitleRef} className="max-h-[calc(100dvh-2rem)] overflow-y-auto break-words sm:max-w-xl [&_[data-slot=button]]:h-auto [&_[data-slot=button]]:min-h-10 [&_[data-slot=button]]:whitespace-normal">
        <DialogHeader>
          <DialogTitle ref={dialogTitleRef} tabIndex={-1}>Map {product.name}</DialogTitle>
          <DialogDescription>Pick a Grocy product, or a Mealie food when the item is not tracked in Grocy.</DialogDescription>
        </DialogHeader>
      <div className="space-y-3 text-sm">
        {!query ? <p className="text-xs text-muted-foreground">Suggestions based on {product.name}. Type to search all targets.</p> : null}
        <p className="text-xs text-muted-foreground">(G+M) Grocy + Mealie linked, recommended · (G) Grocy only · (M) Mealie only</p>
        <SearchableSelect
          className="w-full" ariaLabel="Target" placeholder="Search a Grocy product or Mealie ingredient…" onSearchChange={setQuery}
          value={selected ? targetKey(selected) : null}
          onChange={value => { const next = value === null ? null : targets.find(target => targetKey(target) === value) ?? selected; if (next && (!selected || targetKey(next) !== targetKey(selected) || next.baseUnitId !== selected.baseUnitId)) { setAmount(''); setMealieUnitId(''); unitChosen.current = false; } setSelected(next); }}
          extraOption={selected ? { value: targetKey(selected), label: targetLabel(selected) } : null}
          options={targets.map(target => ({ value: targetKey(target), label: targetLabel(target) }))}
        />
        {!unitsLoaded && !unitsError ? <p className="text-xs text-muted-foreground" role="status">Searching targets…</p> : null}
        {unitsError ? <p className="text-xs text-destructive" role="alert">Targets could not be loaded. Change the search to retry.</p> : null}
        {selected?.linkedFoods?.length ? <p className="text-xs text-muted-foreground">Linked to Mealie: {selected.linkedFoods.map(food => food.name).join(', ')}.</p> : null}
        {selected?.kind === 'mealie_food' ? (
          <div className="space-y-1">
            <SearchableSelect className="w-full" ariaLabel="Mealie unit" placeholder="Count (no unit)" extraOption={mealieUnitId && mapping?.packageBaseUnitId === mealieUnitId ? { value: mealieUnitId, label: mapping.packageBaseUnitName ?? mealieUnitId } : null} value={mealieUnitId} onChange={value => { unitChosen.current = true; if (value !== mealieUnitId) setAmount(''); setMealieUnitId(value ?? ''); }} clearable={false} options={[{ value: '', label: 'Count (no unit)' }, ...mealieUnits.map(unit => ({ value: unit.id, label: unit.name }))]} />
            {unitsError ? <p role="alert" className="text-xs text-destructive">Mealie units could not be loaded; try searching again.</p>
              : unitsLoaded && mealieUnitId && !mealieUnits.some(unit => unit.id === mealieUnitId) ? <p role="alert" className="text-xs text-destructive">This Mealie unit is no longer available; choose another unit.</p> : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <ThemedSelect className="w-full sm:w-56" ariaLabel="Role" value={role} onChange={setRole} options={[{ value: 'preferred', label: 'Preferred product' }, { value: 'alternative', label: 'Remembered alternative' }]} />
          <AppInput className="w-28" value={amount} onChange={event => setAmount(event.target.value)} placeholder="Amount" inputMode="decimal" aria-label="Amount per package" />
          <span className="text-xs text-muted-foreground">
            {product.measure === 'weight' ? 'per kg' : 'per package'} in {selected?.kind === 'grocy_product' ? selected.baseUnitName ?? 'the stock unit' : 'the chosen unit'}
          </span>
        </div>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={fulfilsAll} onChange={event => setFulfilsAll(event.target.checked)} /> A receipt line settles all open rows of this product (loose produce sold by weight)</label>
        {selected ? <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-xs">
          <p>1 {product.measure === 'weight' ? 'kg bought' : 'retailer package'} = {amount || '?'} {selected.kind === 'grocy_product' ? selected.baseUnitName ?? 'stock units' : mealieUnits.find(unit => unit.id === mealieUnitId)?.name ?? (mealieUnitId ? mapping?.packageBaseUnitName ?? 'units' : 'items')} in {selected.kind === 'grocy_product' ? 'Grocy' : 'Mealie'}.</p>
          {preview?.derivation ? <div className="space-y-1"><p>Suggested from catalogue: {preview.derivation.explanation}. Check before saving.</p><Button size="sm" variant="outline" onClick={() => setAmount(String(preview.derivation!.amount))}>Use suggested amount</Button></div> : <p>Enter and confirm the amount from the package or retailer catalogue.</p>}
          {previewError ? <div><p role="alert">Unit preview could not be loaded; check your unit configuration.</p><Button size="sm" variant="outline" onClick={() => setPreviewAttempt(current => current + 1)}>Retry unit preview</Button></div> : null}
          {selected.kind === 'grocy_product' && preview ? <>
            <p>{preview.conversions.filter(item => item.ok).length} Mealie unit conversion(s) available.</p>
            {preview.demandConversions?.map(item => <p key={item.mealieItemId}>{item.mealieUnitName}: {item.ok ? `converts to ${item.amount} ${preview.baseUnitName}` : `Needs configuration or review (${item.reason})`}</p>)}
            {preview.demandConversions?.some(item => !item.ok) ? <p>Some Mealie units cannot be converted or need review. <a className="text-primary underline" href="/conversions">Open Units &amp; Conversions</a></p> : null}
          </> : null}
        </div> : null}
        {mapping && selected && (mapping.targetKind !== selected.kind || mapping.targetId !== selected.id) ? <p className="text-xs text-amber-600 dark:text-amber-400">Moving this mapping removes its link to {mapping.targetName}. Check the amount in the new target unit before saving.</p> : null}
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={!selected || (selected.kind === 'grocy_product' && !preview)}>{mapping && selected && (mapping.targetKind !== selected.kind || mapping.targetId !== selected.id) ? 'Move mapping to this target' : 'Save mapping'}</Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
      </DialogContent>
    </Dialog>
  );
}

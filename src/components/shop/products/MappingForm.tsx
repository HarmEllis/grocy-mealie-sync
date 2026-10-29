'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import type { TargetOption } from '@/lib/shop/targets';
import type { mappingPreview } from '@/lib/shop/mapping-preview';
import { apiJson } from '../api';
import { DButton, Spinner } from '../shop-ui';
import { formatAmount, packageLabel } from './package-size';
import type { Draft, Inventory } from './types';

/** What the footer needs to save a pending draft together with the others of the same product. */
export interface DraftSaver { valid: boolean; persist: () => Promise<boolean> }

/** Unit and package amount for one retailer product, in the design's conversion block. */
export function MappingForm({ target, draft, units, onSaved, onCancel, registerSaver }: {
  target: TargetOption;
  draft: Draft;
  units: Inventory['mealieUnits'];
  onSaved: () => Promise<void>;
  onCancel: () => void;
  registerSaver?: (saver: DraftSaver | null) => void;
}) {
  const [unit, setUnit] = useState(draft.mapping ? draft.mapping.packageBaseUnitId ?? '' : target.baseUnitId ?? '');
  const [amount, setAmount] = useState(target.kind === 'grocy_product' && draft.mapping && (draft.mapping.targetKind !== target.kind || draft.mapping.packageBaseUnitId !== target.baseUnitId) ? '' : draft.mapping?.packageBaseAmount?.toString() ?? '');
  const [fulfilsAll, setFulfilsAll] = useState(Boolean(draft.mapping?.fulfilsAllDemand));
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof mappingPreview>> | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const unitChosen = useRef(target.kind === 'grocy_product' || Boolean(draft.mapping?.confirmed) || Boolean(draft.mapping?.packageBaseUnitId) || Boolean(target.baseUnitId));
  const [baseChosen, setBaseChosen] = useState(unitChosen.current);

  useEffect(() => {
    let cancelled = false; setPreview(null); setError('');
    void apiJson<Awaited<ReturnType<typeof mappingPreview>>>('/api/shop/mappings/preview', { method: 'POST', body: JSON.stringify({ providerId: draft.providerId, retailerProductId: draft.product.externalId, targetKind: target.kind, targetId: target.id, baseUnitId: unit || null }) }).then(result => {
      if (cancelled) return;
      if (!unitChosen.current && result.suggestedBaseUnit) {
        unitChosen.current = true; setBaseChosen(true);
        const suggested = result.suggestedBaseUnit.id ?? '';
        setUnit(suggested); setAmount('');
        if (suggested !== unit) return;
      }
      setPreview(result);
    }).catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [draft.providerId, draft.product.externalId, target.kind, target.id, unit, attempt]);

  const baseName = target.kind === 'grocy_product' ? preview?.baseUnitName ?? target.baseUnitName : units.find(candidate => candidate.id === unit)?.name ?? 'items';
  const changedUnit = target.kind === 'grocy_product' && preview && preview.baseUnitId !== target.baseUnitId;
  const unavailable = draft.product.availability === 'discontinued';
  const deletedUnit = target.kind === 'mealie_food' && unit !== '' && !units.some(candidate => candidate.id === unit);
  const parsed = Number(amount);
  const valid = baseChosen && parsed > 0 && Number.isFinite(parsed) && Boolean(preview) && !changedUnit && !unavailable && !deletedUnit;
  const loose = draft.product.measure === 'weight';
  // What the retailer's package size comes to in the base unit, when that can be derived exactly.
  const expected = preview?.derivation?.amount ?? null;

  /** Saves and confirms the mapping; the caller decides when to reload. */
  async function persist(): Promise<boolean> {
    if (!valid || !preview) return false;
    setSaving(true);
    try {
      const saved = await apiJson<{ warnings: string[] }>('/api/shop/mappings', { method: 'POST', body: JSON.stringify({ providerId: draft.providerId, retailerProductId: draft.product.externalId, targetKind: target.kind, targetId: target.id, targetName: target.name, role: draft.role, baseUnitId: target.kind === 'grocy_product' ? preview.baseUnitId : unit || null, baseUnitName: baseName, packageBaseAmount: parsed, confirm: true, fulfilsAllDemand: fulfilsAll, replacesMappingId: draft.role === 'alternative' ? draft.replaces?.id : undefined }) });
      if (saved.warnings?.includes('availability_unknown')) toast.warning('Mapping saved; current availability could not be verified.');
      toast.success('Mapping and package amount confirmed');
      return true;
    } catch (err) {
      toast.error('Could not save mapping', { description: (err as Error).message });
      return false;
    } finally { setSaving(false); }
  }
  async function save() { if (await persist()) await onSaved(); }

  // The footer saves every valid pending draft; keep its view of this form current without re-rendering the parent.
  const latest = useRef({ valid, persist });
  latest.current = { valid, persist };
  useEffect(() => {
    registerSaver?.({ get valid() { return latest.current.valid; }, persist: () => latest.current.persist() });
    return () => registerSaver?.(null);
  }, [registerSaver]);

  const moved = draft.mapping && (draft.mapping.targetKind !== target.kind || draft.mapping.targetId !== target.id);
  return (
    <div className="conversion" data-testid={`conversion-${draft.providerId}`}>
      <div className="conversion-label">
        <strong>{loose ? 'Set the weight conversion' : 'Set the package amount'}</strong>
        <span className="muted">{draft.product.name}{packageLabel(draft.product) ? ` · package ${packageLabel(draft.product)}` : ''} · {draft.role}</span>
      </div>
      {moved ? <div className="warning-banner inline"><TriangleAlert className="size-4" aria-hidden="true" /><div><p>This was mapped directly to the linked Mealie ingredient. Confirm an amount in the Grocy stock unit to move it to this canonical product.</p></div></div> : null}
      {target.kind === 'mealie_food'
        ? <SearchableSelect className="w-full" ariaLabel="Base unit" placeholder="Choose Mealie base unit" clearable={false} value={baseChosen ? unit : null} options={[{ value: '', label: 'Count (items)' }, ...units.map(candidate => ({ value: candidate.id, label: candidate.name }))]} onChange={value => { unitChosen.current = true; setUnit(value ?? ''); setBaseChosen(true); setAmount(''); }} />
        : <p className="ti-note">Grocy stock unit: <span className="mono">{baseName ?? 'missing'}</span></p>}
      <div className="conversion-line">
        <span>{loose ? '1 kg purchased =' : '1 package ='}</span>
        <input type="text" inputMode="decimal" aria-label="Amount per package" value={amount} onChange={event => setAmount(event.target.value)} />
        <span className="mono">{baseName}</span>
      </div>
      {preview?.derivation ? (
        <div>
          <p className="ti-note">Suggested: {preview.derivation.explanation}. Check it against the package before saving.</p>
          <button type="button" className="text-action" onClick={() => setAmount(String(preview.derivation!.amount))}>Use suggested amount</button>
        </div>
      ) : <p className="ti-note">Enter the amount shown on the package or receipt. Unknown conversions are never guessed.</p>}
      {expected && parsed > 0 && Math.abs(expected - parsed) > expected * 0.01 ? (
        <div className="preview-box bad" role="alert" data-testid="amount-mismatch">
          <TriangleAlert aria-hidden="true" />
          <span>The package is {packageLabel(draft.product)}, which is {formatAmount(expected)} {baseName}, but you entered {formatAmount(parsed)}. Check the amount before confirming.</span>
        </div>
      ) : null}
      {valid && preview ? (
        <div className="preview-box" data-testid={`preview-${draft.providerId}`}>
          <Check aria-hidden="true" />
          <span>
            {loose ? <>Buying <b className="mono">0.5 kg</b> adds <b className="mono">{+(parsed / 2).toFixed(3)} {baseName}</b> to stock.</> : <>Buying <b className="mono">2 packages</b> adds <b className="mono">{+(parsed * 2).toFixed(3)} {baseName}</b> to stock.</>}
            {preview.demandConversions?.length ? <><br /><span className="muted">{preview.demandConversions.map(conversion => `${conversion.mealieUnitName}: ${conversion.ok ? `${conversion.amount} ${preview.baseUnitName}` : `Needs configuration (${conversion.reason})`}`).join(' · ')}</span></> : null}
          </span>
        </div>
      ) : null}
      {changedUnit ? <div className="preview-box bad" role="alert"><TriangleAlert aria-hidden="true" /><span>The Grocy stock unit changed. Refresh the products before confirming.</span></div> : null}
      {deletedUnit ? <div className="preview-box bad" role="alert"><TriangleAlert aria-hidden="true" /><span>This Mealie unit is no longer available; choose another unit.</span></div> : null}
      {unavailable ? <div className="preview-box bad" role="alert"><TriangleAlert aria-hidden="true" /><span>This product is discontinued. Choose a current product; the existing mapping is kept.</span></div> : null}
      {error ? (
        <div className="preview-box bad" role="alert">
          <TriangleAlert aria-hidden="true" />
          <span>{error}<div className="unit-link"><button type="button" className="text-action" onClick={() => setAttempt(value => value + 1)}>Retry preview</button></div></span>
        </div>
      ) : null}
      {preview?.demandConversions?.some(conversion => !conversion.ok) ? (
        <p className="unit-link">Some Mealie units cannot be converted or need review. <Link href="/conversions">Open Units &amp; Conversions</Link></p>
      ) : <p className="unit-link"><Link href="/conversions">Units &amp; Conversions</Link></p>}
      {loose || fulfilsAll ? (
        <label className="settle-produce">
          <input type="checkbox" checked={fulfilsAll} onChange={event => setFulfilsAll(event.target.checked)} />
          <span><b>Fulfils all demand when bought</b><br />A receipt line settles all open rows of this product. Use it for loose produce sold by weight, where the piece count is never exact. The conversion above still decides how much enters stock.</span>
        </label>
      ) : null}
      <div className="subform-actions">
        <DButton variant="ghost" onClick={onCancel}>Cancel</DButton>
        <DButton variant="primary" onClick={() => void save()} disabled={saving || !valid}>{saving ? <Spinner /> : <Check className="size-3.5" />} Confirm mapping</DButton>
      </div>
    </div>
  );
}

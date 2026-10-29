'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock, Link2, Package, Plus, Trash2, TriangleAlert, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import { ThemedSelect } from '@/components/shared/ThemedSelect';
import type { AttentionReason } from '@/lib/shop/product-inventory';
import type { ShopOverview } from '@/lib/shop/overview';
import type { TargetOption } from '@/lib/shop/targets';
import { apiJson } from '../api';
import type { ShopProduct } from '../catalog-options';
import { Badge, DButton, ShopLogo, Spinner } from '../shop-ui';
import { MappingForm, type DraftSaver } from './MappingForm';
import { RetailerSelect } from './RetailerSelect';
import { canChooseProduct, conversionLabel, forTarget, type CatalogData, type Draft, type Inventory, type Mapping, type Provider, type Suggestion } from './types';

const ATTENTION_COPY: Record<AttentionReason, [string, string]> = {
  unit_changed: ['The stock unit changed', 'Review the package amount before confirming. The previous conversion is no longer valid.'],
  unconfirmed: ['Confirm the package amount', 'A mapping only counts once its amount is confirmed. Clearing the shopping list and booking stock follow from it.'],
  discontinued: ['A retailer product is discontinued', 'Choose an available replacement, or rely on a replacement text item where the plugin supports notes.'],
};

export function SourceBadge({ target }: { target: TargetOption }) {
  const Icon = target.source === 'grocy_mealie' ? Link2 : target.kind === 'grocy_product' ? Package : UtensilsCrossed;
  const label = target.source === 'grocy_mealie' ? 'Grocy + Mealie' : target.kind === 'grocy_product' ? 'Grocy only' : 'Mealie only';
  return <span className="source"><Icon aria-hidden="true" />{label}</span>;
}

/** The detail pane of the Products work queue: one section per retailer for the selected product. */
export function ProductDetail({ target, attention, providers, catalog, units, lines, initialDraft, onCatalog, reload, onPrev, onNext, onBack, onAdvance, goToPausedLines }: {
  target: TargetOption;
  attention: AttentionReason[];
  providers: Provider[];
  catalog: CatalogData;
  units: Inventory['mealieUnits'];
  lines: ShopOverview['lines'];
  initialDraft?: Draft;
  onCatalog: (products: ShopProduct[]) => void;
  reload: () => Promise<void>;
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;
  onAdvance: () => void;
  goToPausedLines: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft | undefined>>(initialDraft ? { [initialDraft.providerId]: initialDraft } : {});
  const [adding, setAdding] = useState<string | null>(null);
  const [changing, setChanging] = useState<string | null>(null);
  const [fallbackAccounts, setFallbackAccounts] = useState<Record<string, string>>({});
  const [fallbackSaving, setFallbackSaving] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const savers = useRef(new Map<string, DraftSaver>());

  const setDraft = (providerId: string, draft: Draft | null) => setDrafts(current => ({ ...current, [providerId]: draft ?? undefined }));
  async function remove(mapping: Mapping) {
    try { await apiJson(`/api/shop/mappings/${mapping.id}`, { method: 'DELETE' }); await reload(); if (drafts[mapping.providerId]?.mapping?.id === mapping.id) setDraft(mapping.providerId, null); }
    catch (err) { toast.error('Could not remove mapping', { description: (err as Error).message }); }
  }
  async function acceptSuggestion(provider: Provider, suggestion: Suggestion) {
    try {
      const result = await apiJson<{ mapping?: Mapping }>(`/api/shop/suggestions/${suggestion.id}`, { method: 'POST', body: JSON.stringify({ action: 'accept' }) });
      const mapping = result.mapping;
      const product = mapping && catalog.products.find(candidate => candidate.providerId === mapping.providerId && candidate.externalId === mapping.retailerProductId);
      if (mapping && product) setDraft(provider.id, { providerId: provider.id, product, role: mapping.role === 'alternative' ? 'alternative' : 'preferred', mapping });
      toast.success('Mapping saved; check its unit and package amount');
      await reload();
    } catch (err) { toast.error((err as Error).message); }
  }

  /** Saves every pending valid draft of this product, then moves on. Never needs every retailer mapped. */
  const confirm = useCallback(async () => {
    if (confirming) return;
    const pending = [...savers.current.values()].filter(saver => saver.valid);
    setConfirming(true);
    try {
      for (const saver of pending) if (!(await saver.persist())) return;
      if (pending.length) { await reload(); setDrafts({}); }
      onAdvance();
    } finally { setConfirming(false); }
  }, [confirming, onAdvance, reload]);

  // Enter confirms and advances unless the user is typing in a control.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.defaultPrevented) return;
      const element = event.target as HTMLElement | null;
      if (element?.closest('input, select, textarea, button, a, [role="combobox"], [role="listbox"], [role="dialog"]')) return;
      void confirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirm]);

  return (
    <>
      <header className="detail-header">
        <div className="detail-topline">
          <button type="button" className="icon-button mobile-back" onClick={onBack} aria-label="Back to queue"><ArrowLeft aria-hidden="true" />All products</button>
          <span className="eyebrow">Product mapping</span>
          <div className="detail-nav">
            <button type="button" className="icon-button" onClick={onPrev} aria-label="Previous product"><ArrowLeft aria-hidden="true" /></button>
            <button type="button" className="icon-button" onClick={onNext} aria-label="Next product"><ArrowRight aria-hidden="true" /></button>
          </div>
        </div>
        <div className="detail-title">
          <div>
            <h2 data-testid="selected-product-name">{target.name}</h2>
            <SourceBadge target={target} />
            {target.linkedFoods?.length ? <p className="small muted">Mealie: {target.linkedFoods.map(food => food.name).join(', ')}</p> : null}
          </div>
          <div className="stock-unit">{target.kind === 'grocy_product' ? 'Grocy stock unit' : 'Mealie unit'}<strong>{target.baseUnitName ?? (target.kind === 'grocy_product' ? 'missing' : 'per shop')}</strong></div>
        </div>
      </header>

      <div className="detail-body">
        {attention.map(reason => (
          <div key={reason} className="warning-banner" data-testid="product-warning">
            <TriangleAlert aria-hidden="true" />
            <div><strong>{ATTENTION_COPY[reason][0]}</strong><p>{ATTENTION_COPY[reason][1]}</p></div>
          </div>
        ))}
        {providers.map(provider => {
          const mappings = catalog.mappings.filter(mapping => mapping.providerId === provider.id && forTarget(mapping, target));
          const main = mappings.find(mapping => mapping.role === 'preferred' && mapping.targetKind === target.kind && mapping.targetId === target.id) ?? mappings.find(mapping => mapping.role === 'preferred');
          const alternatives = mappings.filter(mapping => mapping.id !== main?.id);
          const productOf = (mapping?: Mapping) => catalog.products.find(product => product.providerId === provider.id && product.externalId === mapping?.retailerProductId);
          const mainProduct = productOf(main);
          const draft = drafts[provider.id];
          const suggestion = main ? null : catalog.suggestions.filter(candidate => candidate.providerId === provider.id && forTarget(candidate, target)).sort((a, b) => b.score - a.score)[0] ?? null;
          const suggestionProduct = suggestion ? catalog.products.find(product => product.providerId === provider.id && product.externalId === suggestion.retailerProductId) : undefined;
          const account = provider.installations.find(installation => installation.id === fallbackAccounts[provider.id]) ?? provider.installations.find(installation => installation.connected) ?? provider.installations[0];
          const manualNote = Boolean(main && account.manualNoteProductIds?.includes(main.retailerProductId));
          const discontinued = mainProduct?.availability === 'discontinued';
          const canWriteNotes = Boolean(account.features?.includes('list.notes'));
          const bound = Boolean(account.settings.boundAccountKey);
          const noteOn = Boolean(main) && canWriteNotes && bound && (manualNote || discontinued);
          const blocks = main ? (account.listReplacementBlocks ?? []).filter(block => block.retailerProductId === main.retailerProductId) : [];
          const pausedProductLine = Boolean(main) && lines.some(line => line.installationId === account.id && line.retailerProductId === main?.retailerProductId && line.kind !== 'note' && line.pausedReason && line.pausedReason !== 'released');
          const choose = (product: ShopProduct | null, role: 'preferred' | 'alternative', mapping?: Mapping) => {
            if (product && canChooseProduct(catalog, provider.id, product, target, role, mapping?.id)) {
              setDraft(provider.id, { providerId: provider.id, product, role, mapping: product.externalId === mapping?.retailerProductId ? mapping : undefined, replaces: product.externalId !== mapping?.retailerProductId ? mapping : undefined });
              setAdding(null); setChanging(null);
            } else if (!product && mapping) void remove(mapping);
          };
          const openAmount = (mapping: Mapping) => {
            const product = productOf(mapping);
            if (product) setDraft(provider.id, { providerId: provider.id, product, role: mapping.role === 'preferred' ? 'preferred' : 'alternative', mapping });
          };
          const usePreferred = async (mapping: Mapping) => {
            if (mapping.targetKind !== target.kind || mapping.targetId !== target.id) { openAmount({ ...mapping, role: 'preferred' }); return; }
            try { await apiJson(`/api/shop/mappings/${mapping.id}`, { method: 'PATCH', body: JSON.stringify({ role: 'preferred' }) }); await reload(); }
            catch (err) { toast.error((err as Error).message); }
          };
          const toggleNote = async () => {
            if (!main) return;
            setFallbackSaving(provider.id);
            try {
              await apiJson('/api/shop/lists/fallback', { method: 'POST', body: JSON.stringify({ installationId: account.id, retailerProductId: main.retailerProductId, mode: manualNote ? 'product' : 'note' }) });
              await reload();
              toast.success(manualNote ? 'Preferred product restored for this account' : 'Text fallback selected for this account');
            } catch (err) { toast.error('Could not change list fallback', { description: (err as Error).message }); }
            finally { setFallbackSaving(null); }
          };
          const why = !canWriteNotes ? `${provider.name} cannot add list notes, so a text item is not possible here. A discontinued product pauses the line instead.` : !bound ? 'Sign in to the retailer first.' : '';
          const online = Boolean(provider.installationId);
          return (
            <section key={provider.id} className="shop-section" data-testid={`shop-${provider.id}`}>
              <div className="shop-heading">
                <div className="shop-name">
                  <ShopLogo name={provider.name} />
                  <div><h3>{provider.name}</h3><small>{online ? (canWriteNotes ? 'Supports list notes' : 'Plugin connected') : 'Plugin offline'}</small></div>
                </div>
                <span className="saved-state">{main ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}{main ? (main.confirmed && !draft ? 'Confirmed' : 'Ready to confirm') : 'Not mapped'}</span>
              </div>

              {main ? (
                <>
                  <div className="match-card">
                    <div className="match-top">
                      <div className="match-info">
                        <strong>{main.retailerProductName}</strong>
                        <div className="match-meta">
                          <span>{conversionLabel(main, mainProduct)}</span>
                          <Badge tone={main.confirmed ? 'success' : 'warning'}>{main.confirmed ? 'confirmed' : 'needs confirmation'}</Badge>
                          {mainProduct?.availability === 'discontinued' ? <Badge tone="danger">Discontinued</Badge> : mainProduct?.availability === 'temporarily_unavailable' ? <Badge tone="warning">Temporarily out of stock</Badge> : mainProduct?.availability === 'available' ? <Badge tone="success">Available</Badge> : null}
                        </div>
                      </div>
                      <DButton variant="ghost" onClick={() => openAmount(main)}>Unit &amp; amount</DButton>
                    </div>
                  </div>
                  {discontinued ? <p className="avail-line bad"><TriangleAlert aria-hidden="true" /><span><b>Discontinued</b> · list sync needs a text item or a new preferred product</span></p>
                    : mainProduct?.availability === 'temporarily_unavailable' ? <p className="avail-line warn"><Clock aria-hidden="true" /><span><b>Temporarily out of stock</b> · preferred product stays on the list</span></p>
                      : !mainProduct?.availability || mainProduct.availability === 'unknown' ? <p className="avail-line"><span><b>Availability unknown</b> · the retailer did not report a status</span></p> : null}
                  {blocks.map(block => (
                    <div key={`${block.blockingRetailerProductId}:${block.blockingKind}`} className="warning-banner inline" data-testid="replacement-notice">
                      <Clock aria-hidden="true" />
                      <div>
                        <strong>Waiting for {block.blockingProductName} to leave the list ({account.name})</strong>
                        <p>Review the old line in Overview → Paused list lines if it remains paused.</p>
                        {pausedProductLine ? <p><b>Waiting for the paused product line.</b> Resolve it before the text item can replace it.</p> : null}
                        <p><button type="button" className="text-action" onClick={goToPausedLines}>Open Overview → Paused list lines</button></p>
                      </div>
                    </div>
                  ))}
                  <div className="role-line">
                    <span className="badge success">Preferred product</span>
                    <span>Used for the shared list and for receipt matching.</span>
                    <button type="button" className="icon-button" onClick={() => void remove(main)} aria-label={`Remove ${main.retailerProductName}`}><Trash2 aria-hidden="true" /></button>
                  </div>
                  {draft ? <MappingForm key={`${draft.product.externalId}:${draft.role}:${draft.mapping?.id ?? 'new'}`} target={target} draft={draft} units={units} onSaved={async () => { await reload(); setDraft(provider.id, null); }} onCancel={() => setDraft(provider.id, null)} registerSaver={saver => { if (saver) savers.current.set(provider.id, saver); else savers.current.delete(provider.id); }} /> : null}
                  <details className="advanced" open={noteOn || undefined}>
                    <summary>Text item{noteOn ? <Badge tone="success">active</Badge> : !canWriteNotes || !bound ? <Badge>not available</Badge> : null}</summary>
                    <div className="textitem">
                      <h4><UtensilsCrossed aria-hidden="true" /> Ingredient + quantity text item</h4>
                      {provider.installations.length > 1
                        ? <div className="field"><span>Text item account for {provider.name}</span><ThemedSelect ariaLabel={`Text item account for ${provider.name}`} value={account.id} options={provider.installations.map(installation => ({ value: installation.id, label: `${installation.name}${installation.accountLabel ? ` · ${installation.accountLabel}` : ''}${installation.settings.boundAccountKey ? '' : ' (not signed in)'}` }))} onChange={id => setFallbackAccounts(current => ({ ...current, [provider.id]: id }))} className="w-full" /></div>
                        : <p className="ti-note">Account: <b>{account.name}{account.accountLabel ? ` · ${account.accountLabel}` : ''}</b>{bound ? '' : ' · not signed in'}</p>}
                      <label className="ti-toggle">
                        <input type="checkbox" checked={noteOn} disabled={!canWriteNotes || !bound || fallbackSaving === provider.id || (manualNote && discontinued) || discontinued} onChange={() => void toggleNote()} />
                        <span>Use an ingredient + quantity text item instead of the preferred product{discontinued && canWriteNotes ? <><br /><b>Locked on</b> · this retailer product is discontinued, so gm-sync writes the text item automatically.</> : null}</span>
                      </label>
                      {fallbackSaving === provider.id ? <p className="ti-note"><Spinner /> Saving…</p> : null}
                      {why ? <p className="ti-note">{why}</p> : null}
                      {pausedProductLine ? <p className="ti-note">Waiting for the paused product line. Review and resolve it under Overview → Paused list lines before the text item can replace it.</p> : null}
                      <p className="ti-note">Written as one ingredient and quantity note. Checking a note off never fulfils Mealie demand; receipts decide what was bought.</p>
                    </div>
                  </details>
                </>
              ) : (
                <>
                  {suggestion ? (
                    <>
                      <div className="match-label"><span><Check aria-hidden="true" /> Suggested match</span><span className="score">{Math.round(suggestion.score * 100)}% match</span></div>
                      <div className="match-card">
                        <div className="match-top">
                          <div className="match-info"><strong>{suggestionProduct?.name ?? suggestion.retailerProductId}</strong>{suggestionProduct?.packageAmount ? <div className="match-meta"><span>{suggestionProduct.packageAmount} {suggestionProduct.packageUnit}</span></div> : null}</div>
                          <DButton variant="ghost" onClick={() => void acceptSuggestion(provider, suggestion)}>Use this <ArrowRight className="size-3.5" /></DButton>
                        </div>
                      </div>
                    </>
                  ) : null}
                  <p className="ti-note">Pick a preferred product below first. A text item needs one, because it replaces that product on the list.</p>
                  {draft ? <MappingForm key={`${draft.product.externalId}:${draft.role}:new`} target={target} draft={draft} units={units} onSaved={async () => { await reload(); setDraft(provider.id, null); }} onCancel={() => setDraft(provider.id, null)} registerSaver={saver => { if (saver) savers.current.set(provider.id, saver); else savers.current.delete(provider.id); }} /> : null}
                </>
              )}

              <div className="catalogue-search">
                <RetailerSelect provider={provider} products={catalog.products} target={target} suggestions={catalog.suggestions} value={changing === provider.id ? main?.retailerProductId ?? null : null} selectedName={changing === provider.id ? main?.retailerProductName : undefined} onCatalog={onCatalog} onChoose={product => choose(product, 'preferred', main)} />
              </div>
              <div className="search-help">
                <span>{main ? 'Choose another product to replace the preferred one, or add an alternative below.' : 'Search by product name or barcode.'}</span>
                {!online ? <span className="muted">Plugin offline</span> : null}
              </div>

              {alternatives.length ? <div className="alternative-title">Remembered alternatives · {alternatives.length}</div> : null}
              {alternatives.map(mapping => (
                <div key={mapping.id} className="alternative">
                  <span>{mapping.targetKind === 'mealie_food' && target.kind === 'grocy_product' ? `Linked Mealie mapping · ${mapping.targetName}` : mapping.retailerProductName}<br /><span className="muted">{conversionLabel(mapping, productOf(mapping))} · {mapping.confirmed ? 'confirmed' : 'needs confirmation'}</span></span>
                  <button type="button" className="text-action" onClick={() => openAmount(mapping)}>Unit &amp; amount</button>
                  <button type="button" className="text-action" onClick={() => void usePreferred(mapping)}>Use as preferred</button>
                  <button type="button" className="icon-button" onClick={() => void remove(mapping)} aria-label={`Remove ${mapping.retailerProductName}`}><Trash2 aria-hidden="true" /></button>
                </div>
              ))}
              {main ? (
                adding === provider.id
                  ? <RetailerSelect provider={provider} products={catalog.products} target={target} suggestions={catalog.suggestions} value={null} onCatalog={onCatalog} onChoose={product => choose(product, 'alternative')} />
                  : <DButton variant="ghost" onClick={() => setAdding(provider.id)}><Plus className="size-3.5" /> Add alternative</DButton>
              ) : null}
              {main && changing !== provider.id ? <DButton variant="ghost" onClick={() => setChanging(provider.id)}>Change preferred product</DButton> : null}
            </section>
          );
        })}
      </div>

      <footer className="detail-footer">
        <p>Saves the amounts you filled in for every retailer and moves to the next product. A household that uses one retailer only needs that one.</p>
        <button type="button" className="button primary" onClick={() => void confirm()} disabled={confirming} data-testid="confirm-mapping">
          {confirming ? <Spinner /> : <Check className="size-4" aria-hidden="true" />} Confirm &amp; next <span className="small">↵</span>
        </button>
      </footer>
    </>
  );
}


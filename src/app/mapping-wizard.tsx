'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import SearchableSelect from './searchable-select';

// --- Types ---

interface MealieFood { id: string; name: string }
interface MealieUnit { id: string; name: string; abbreviation: string }
interface GrocyProduct { id: number; name: string; quIdPurchase: number }
interface GrocyUnit { id: number; name: string }
interface UnitMappingRef { id: string; grocyUnitId: number; grocyUnitName: string; mealieUnitName: string }
interface ProductSuggestion { grocyProductId: number; grocyProductName: string; score: number; suggestedUnitId: number | null }
interface UnitSuggestion { grocyUnitId: number; grocyUnitName: string; score: number }

interface WizardData {
  unmappedMealieFoods: MealieFood[];
  unmappedMealieUnits: MealieUnit[];
  grocyProducts: GrocyProduct[];
  grocyUnits: GrocyUnit[];
  existingUnitMappings: UnitMappingRef[];
  productSuggestions: Record<string, ProductSuggestion>;
  unitSuggestions: Record<string, UnitSuggestion>;
  orphanGrocyProductCount: number;
  orphanGrocyUnitCount: number;
}

interface ProductMapping { mealieFoodId: string; grocyProductId: number | null; grocyUnitId: number | null }
interface UnitMapping { mealieUnitId: string; grocyUnitId: number | null }

// --- Styles ---

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modal: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: '1.5rem', width: '95vw', maxWidth: 1000,
  maxHeight: '90vh', overflow: 'auto', position: 'relative',
};
const tabBar: React.CSSProperties = {
  display: 'flex', gap: '0.25rem', borderBottom: '2px solid #e0e0e0', marginBottom: '1rem',
};
const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '0.5rem 1.25rem', cursor: 'pointer', fontWeight: active ? 'bold' : 'normal',
  borderBottom: active ? '2px solid #333' : '2px solid transparent',
  marginBottom: -2, background: 'none', border: 'none', fontSize: '1rem',
});
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' };
const th: React.CSSProperties = { textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #ddd', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '0.4rem 0.5rem', borderBottom: '1px solid #eee', verticalAlign: 'middle' };
const searchInput: React.CSSProperties = {
  padding: '0.4rem 0.6rem', fontSize: '0.9rem', border: '1px solid #d1d5db', borderRadius: 6,
  width: '100%', maxWidth: 300, marginBottom: '0.75rem',
};
const btnPrimary: React.CSSProperties = {
  padding: '0.5rem 1rem', fontSize: '0.9rem', cursor: 'pointer',
  background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6,
};
const btnSecondary: React.CSSProperties = {
  padding: '0.5rem 1rem', fontSize: '0.9rem', cursor: 'pointer',
  background: '#f3f4f6', color: '#333', border: '1px solid #d1d5db', borderRadius: 6,
};
const btnDanger: React.CSSProperties = {
  padding: '0.5rem 1rem', fontSize: '0.9rem', cursor: 'pointer',
  background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6,
};
const badge = (score: number): React.CSSProperties => ({
  display: 'inline-block', padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 'bold',
  background: score >= 70 ? '#dcfce7' : score >= 40 ? '#fef9c3' : '#fee2e2',
  color: score >= 70 ? '#166534' : score >= 40 ? '#854d0e' : '#991b1b',
});
const closeBtn: React.CSSProperties = {
  position: 'absolute', top: '0.75rem', right: '1rem', background: 'none',
  border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#666',
};

const sortByName = <T extends { name: string }>(items: T[]) => [...items].sort((a, b) => a.name.localeCompare(b.name));

// --- Component ---

export default function MappingWizard() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'products' | 'units'>('units');
  const [data, setData] = useState<WizardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionRunning, setActionRunning] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [unitSearch, setUnitSearch] = useState('');

  const [productMaps, setProductMaps] = useState<Record<string, ProductMapping>>({});
  const [unitMaps, setUnitMaps] = useState<Record<string, UnitMapping>>({});
  const [defaultCreateUnitId, setDefaultCreateUnitId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/mapping-wizard/data');
      if (!res.ok) throw new Error('Failed to fetch');
      const d: WizardData = await res.json();
      setData(d);

      const pMaps: Record<string, ProductMapping> = {};
      for (const food of d.unmappedMealieFoods) {
        pMaps[food.id] = { mealieFoodId: food.id, grocyProductId: null, grocyUnitId: null };
      }
      setProductMaps(pMaps);

      const uMaps: Record<string, UnitMapping> = {};
      for (const unit of d.unmappedMealieUnits) {
        uMaps[unit.id] = { mealieUnitId: unit.id, grocyUnitId: null };
      }
      setUnitMaps(uMaps);

      setDefaultCreateUnitId(prev => prev ?? (d.grocyUnits[0]?.id ?? null));

      // Default to products tab if all units are already mapped
      if (d.unmappedMealieUnits.length === 0 && d.unmappedMealieFoods.length > 0) {
        setTab('products');
      } else {
        setTab('units');
      }
    } catch {
      setMessage('Failed to load mapping data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  // Sorted options for SearchableSelect
  const grocyProductOptions = useMemo(() =>
    data ? sortByName(data.grocyProducts).map(p => ({ value: p.id, label: p.name })) : [],
    [data],
  );
  const grocyUnitOptions = useMemo(() =>
    data ? sortByName(data.grocyUnits).map(u => ({ value: u.id, label: u.name })) : [],
    [data],
  );

  // Filtered & sorted Mealie lists
  const filteredFoods = useMemo(() => {
    if (!data) return [];
    const sorted = sortByName(data.unmappedMealieFoods);
    if (!productSearch) return sorted;
    const q = productSearch.toLowerCase();
    return sorted.filter(f => f.name.toLowerCase().includes(q));
  }, [data, productSearch]);

  const filteredUnits = useMemo(() => {
    if (!data) return [];
    const sorted = sortByName(data.unmappedMealieUnits);
    if (!unitSearch) return sorted;
    const q = unitSearch.toLowerCase();
    return sorted.filter(u => u.name.toLowerCase().includes(q) || u.abbreviation.toLowerCase().includes(q));
  }, [data, unitSearch]);

  function showMessage(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(''), 5000);
  }

  async function enableAutoCreate(field: 'autoCreateProducts' | 'autoCreateUnits') {
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: true }),
      });
    } catch { /* best effort */ }
  }

  async function runAction(name: string, fn: () => Promise<void>) {
    setActionRunning(name);
    setMessage('');
    try {
      await fn();
      await fetchData();
    } catch (e) {
      showMessage(`Error: ${e}`);
    } finally {
      setActionRunning(null);
      setConfirmAction(null);
    }
  }

  // --- Accept Suggestions ---

  function acceptAllProductSuggestions() {
    if (!data) return;
    setProductMaps(prev => {
      const next = { ...prev };
      for (const food of data.unmappedMealieFoods) {
        const s = data.productSuggestions[food.id];
        if (s) next[food.id] = { mealieFoodId: food.id, grocyProductId: s.grocyProductId, grocyUnitId: s.suggestedUnitId };
      }
      return next;
    });
  }

  function acceptProductSuggestion(id: string) {
    const s = data?.productSuggestions[id];
    if (!s) return;
    setProductMaps(prev => ({ ...prev, [id]: { mealieFoodId: id, grocyProductId: s.grocyProductId, grocyUnitId: s.suggestedUnitId } }));
  }

  function acceptAllUnitSuggestions() {
    if (!data) return;
    setUnitMaps(prev => {
      const next = { ...prev };
      for (const unit of data.unmappedMealieUnits) {
        const s = data.unitSuggestions[unit.id];
        if (s) next[unit.id] = { mealieUnitId: unit.id, grocyUnitId: s.grocyUnitId };
      }
      return next;
    });
  }

  function acceptUnitSuggestion(id: string) {
    const s = data?.unitSuggestions[id];
    if (!s) return;
    setUnitMaps(prev => ({ ...prev, [id]: { mealieUnitId: id, grocyUnitId: s.grocyUnitId } }));
  }

  // --- Product Actions ---

  async function syncProducts() {
    const filled = Object.values(productMaps).filter(m => m.grocyProductId !== null);
    if (filled.length === 0) { showMessage('No products mapped'); return; }

    await runAction('syncProducts', async () => {
      const res = await fetch('/api/mapping-wizard/products/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mappings: filled.map(m => ({ mealieFoodId: m.mealieFoodId, grocyProductId: m.grocyProductId, grocyUnitId: m.grocyUnitId || 0 })),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      // Check remaining unmapped after refresh — if 0, enable auto-create
      const checkRes = await fetch('/api/mapping-wizard/data');
      const checkData: WizardData = await checkRes.json();
      if (checkData.unmappedMealieFoods.length === 0) {
        await enableAutoCreate('autoCreateProducts');
        showMessage(`Synced ${result.synced} products, renamed ${result.renamed}. Auto-create products enabled.`);
      } else {
        showMessage(`Synced ${result.synced} products, renamed ${result.renamed}`);
      }
    });
  }

  async function createUnmappedProducts() {
    if (!data) return;
    const unmappedIds = Object.entries(productMaps).filter(([, m]) => m.grocyProductId === null).map(([id]) => id);
    if (unmappedIds.length === 0) { showMessage('No unmapped products to create'); return; }
    if (!defaultCreateUnitId) { showMessage('Select a default unit first'); return; }

    await runAction('createProducts', async () => {
      const res = await fetch('/api/mapping-wizard/products/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealieFoodIds: unmappedIds, defaultGrocyUnitId: defaultCreateUnitId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      const checkRes = await fetch('/api/mapping-wizard/data');
      const checkData: WizardData = await checkRes.json();
      if (checkData.unmappedMealieFoods.length === 0) {
        await enableAutoCreate('autoCreateProducts');
        showMessage(`Created ${result.created} products. Auto-create products enabled.`);
      } else {
        showMessage(`Created ${result.created} products${result.skipped ? `, ${result.skipped} skipped` : ''}`);
      }
    });
  }

  async function deleteOrphanProducts() {
    await runAction('deleteOrphanProducts', async () => {
      const res = await fetch('/api/mapping-wizard/products/orphans', { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      showMessage(`Deleted ${result.deleted} orphan products`);
    });
  }

  // --- Unit Actions ---

  async function syncUnits() {
    const filled = Object.values(unitMaps).filter(m => m.grocyUnitId !== null);
    if (filled.length === 0) { showMessage('No units mapped'); return; }

    await runAction('syncUnits', async () => {
      const res = await fetch('/api/mapping-wizard/units/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: filled.map(m => ({ mealieUnitId: m.mealieUnitId, grocyUnitId: m.grocyUnitId })) }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      const checkRes = await fetch('/api/mapping-wizard/data');
      const checkData: WizardData = await checkRes.json();
      if (checkData.unmappedMealieUnits.length === 0) {
        await enableAutoCreate('autoCreateUnits');
        showMessage(`Synced ${result.synced} units, renamed ${result.renamed}. Auto-create units enabled.`);
      } else {
        showMessage(`Synced ${result.synced} units, renamed ${result.renamed}`);
      }
    });
  }

  async function createUnmappedUnits() {
    if (!data) return;
    const unmappedIds = Object.entries(unitMaps).filter(([, m]) => m.grocyUnitId === null).map(([id]) => id);
    if (unmappedIds.length === 0) { showMessage('No unmapped units to create'); return; }

    await runAction('createUnits', async () => {
      const res = await fetch('/api/mapping-wizard/units/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealieUnitIds: unmappedIds }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      const checkRes = await fetch('/api/mapping-wizard/data');
      const checkData: WizardData = await checkRes.json();
      if (checkData.unmappedMealieUnits.length === 0) {
        await enableAutoCreate('autoCreateUnits');
        showMessage(`Created ${result.created} units. Auto-create units enabled.`);
      } else {
        showMessage(`Created ${result.created} units${result.skipped ? `, ${result.skipped} skipped` : ''}`);
      }
    });
  }

  async function deleteOrphanUnits() {
    await runAction('deleteOrphanUnits', async () => {
      const res = await fetch('/api/mapping-wizard/units/orphans', { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      showMessage(`Deleted ${result.deleted} orphan units`);
    });
  }

  // --- Confirmation Dialog ---

  function ConfirmDialog({ action, label, onConfirm }: { action: string; label: string; onConfirm: () => void }) {
    if (confirmAction !== action) return null;
    return (
      <div style={{ ...overlay, zIndex: 1100 }}>
        <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', maxWidth: 400, textAlign: 'center' }}>
          <p style={{ marginBottom: '1rem', fontWeight: 'bold' }}>{label}</p>
          <p style={{ marginBottom: '1.5rem', color: '#666', fontSize: '0.9rem' }}>This action cannot be undone.</p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button style={btnSecondary} onClick={() => setConfirmAction(null)} disabled={!!actionRunning}>Cancel</button>
            <button style={btnDanger} onClick={onConfirm} disabled={!!actionRunning}>{actionRunning ? 'Running...' : 'Confirm'}</button>
          </div>
        </div>
      </div>
    );
  }

  // --- Render ---

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ ...btnPrimary, marginTop: '0.5rem' }}>
        Mapping Wizard
      </button>
    );
  }

  const isRunning = !!actionRunning;
  const productMappedCount = Object.values(productMaps).filter(m => m.grocyProductId !== null).length;
  const unitMappedCount = Object.values(unitMaps).filter(m => m.grocyUnitId !== null).length;

  return (
    <>
      <button onClick={() => setOpen(false)} style={{ ...btnPrimary, marginTop: '0.5rem', opacity: 0.7 }}>
        Mapping Wizard (Open)
      </button>

      <div style={overlay} onClick={() => !isRunning && setOpen(false)}>
        <div style={modal} onClick={e => e.stopPropagation()}>
          <button style={closeBtn} onClick={() => !isRunning && setOpen(false)} title="Close">&times;</button>
          <h2 style={{ margin: '0 0 0.5rem' }}>Mapping Wizard</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', margin: '0 0 1rem' }}>
            Map Mealie items to existing Grocy items, or create new ones. Start with units, then products.
          </p>

          {message && (
            <div style={{
              padding: '0.5rem 1rem', marginBottom: '1rem', borderRadius: 6,
              background: message.startsWith('Error') ? '#fee2e2' : '#dcfce7',
              color: message.startsWith('Error') ? '#991b1b' : '#166534',
              fontSize: '0.9rem',
            }}>
              {message}
            </div>
          )}

          {loading ? (
            <p>Loading data from Mealie and Grocy...</p>
          ) : !data ? (
            <p style={{ color: '#991b1b' }}>Failed to load data. Check API connections.</p>
          ) : (
            <>
              {/* Tabs */}
              <div style={tabBar}>
                <button style={tabStyle(tab === 'units')} onClick={() => setTab('units')}>
                  Units ({data.unmappedMealieUnits.length} unmapped)
                </button>
                <button style={tabStyle(tab === 'products')} onClick={() => setTab('products')}>
                  Products ({data.unmappedMealieFoods.length} unmapped)
                </button>
              </div>

              {/* === UNITS TAB === */}
              {tab === 'units' && (
                <div>
                  {data.unmappedMealieUnits.length === 0 ? (
                    <p style={{ color: '#166534', background: '#dcfce7', padding: '0.75rem 1rem', borderRadius: 6 }}>
                      All Mealie units are mapped. You can continue to the Products tab.
                    </p>
                  ) : (
                    <>
                      {/* Actions bar */}
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
                        {Object.keys(data.unitSuggestions).length > 0 && (
                          <button style={btnSecondary} onClick={acceptAllUnitSuggestions} disabled={isRunning}>
                            Accept All Suggestions ({Object.keys(data.unitSuggestions).length})
                          </button>
                        )}
                        <input
                          type="text"
                          placeholder="Filter Mealie units..."
                          value={unitSearch}
                          onChange={e => setUnitSearch(e.target.value)}
                          style={searchInput}
                        />
                      </div>

                      {/* Table */}
                      <div style={{ overflowX: 'auto', maxHeight: 400, overflow: 'auto' }}>
                        <table style={table}>
                          <thead>
                            <tr>
                              <th style={th}>Mealie Unit</th>
                              <th style={th}>Abbr.</th>
                              <th style={{ ...th, width: '40%' }}>Grocy Unit</th>
                              <th style={{ ...th, width: 70 }}>Match</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredUnits.map(unit => {
                              const mapping = unitMaps[unit.id];
                              const suggestion = data.unitSuggestions[unit.id];
                              const isAccepted = mapping?.grocyUnitId !== null;
                              return (
                                <tr key={unit.id} style={{ background: isAccepted ? '#f0fdf4' : undefined }}>
                                  <td style={td}><strong>{unit.name}</strong></td>
                                  <td style={{ ...td, color: '#666' }}>{unit.abbreviation || '-'}</td>
                                  <td style={td}>
                                    <SearchableSelect
                                      options={grocyUnitOptions}
                                      value={mapping?.grocyUnitId ?? null}
                                      onChange={val => setUnitMaps(prev => ({ ...prev, [unit.id]: { ...prev[unit.id], grocyUnitId: val } }))}
                                      placeholder="Select Grocy unit..."
                                      style={{ maxWidth: 280 }}
                                    />
                                  </td>
                                  <td style={td}>
                                    {suggestion && !isAccepted ? (
                                      <button
                                        style={{ ...btnSecondary, padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                        onClick={() => acceptUnitSuggestion(unit.id)}
                                        title={`Accept: ${suggestion.grocyUnitName}`}
                                      >
                                        <span style={badge(suggestion.score)}>{suggestion.score}%</span>
                                      </button>
                                    ) : suggestion ? (
                                      <span style={badge(suggestion.score)}>{suggestion.score}%</span>
                                    ) : null}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* Unit action buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem', alignItems: 'center' }}>
                    <button style={btnPrimary} onClick={syncUnits} disabled={isRunning || unitMappedCount === 0}>
                      {actionRunning === 'syncUnits' ? 'Syncing...' : `Sync Mapped (${unitMappedCount})`}
                    </button>
                    <button style={btnSecondary} onClick={createUnmappedUnits} disabled={isRunning}>
                      {actionRunning === 'createUnits' ? 'Creating...' : 'Create Unmapped in Grocy'}
                    </button>
                    <button
                      style={btnDanger}
                      onClick={() => setConfirmAction('deleteOrphanUnits')}
                      disabled={isRunning || data.orphanGrocyUnitCount === 0}
                    >
                      Delete Grocy Orphans ({data.orphanGrocyUnitCount})
                    </button>
                  </div>
                </div>
              )}

              {/* === PRODUCTS TAB === */}
              {tab === 'products' && (
                <div>
                  {data.unmappedMealieFoods.length === 0 ? (
                    <p style={{ color: '#166534', background: '#dcfce7', padding: '0.75rem 1rem', borderRadius: 6 }}>
                      All Mealie products are mapped. Auto-sync will handle new products from here.
                    </p>
                  ) : (
                    <>
                      {/* Actions bar */}
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
                        {Object.keys(data.productSuggestions).length > 0 && (
                          <button style={btnSecondary} onClick={acceptAllProductSuggestions} disabled={isRunning}>
                            Accept All Suggestions ({Object.keys(data.productSuggestions).length})
                          </button>
                        )}
                        <input
                          type="text"
                          placeholder="Filter Mealie products..."
                          value={productSearch}
                          onChange={e => setProductSearch(e.target.value)}
                          style={searchInput}
                        />
                      </div>

                      {/* Table */}
                      <div style={{ overflowX: 'auto', maxHeight: 400, overflow: 'auto' }}>
                        <table style={table}>
                          <thead>
                            <tr>
                              <th style={th}>Mealie Product</th>
                              <th style={{ ...th, width: '35%' }}>Grocy Product</th>
                              <th style={{ ...th, width: '20%' }}>Unit</th>
                              <th style={{ ...th, width: 70 }}>Match</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredFoods.map(food => {
                              const mapping = productMaps[food.id];
                              const suggestion = data.productSuggestions[food.id];
                              const isAccepted = mapping?.grocyProductId !== null;
                              return (
                                <tr key={food.id} style={{ background: isAccepted ? '#f0fdf4' : undefined }}>
                                  <td style={td}><strong>{food.name}</strong></td>
                                  <td style={td}>
                                    <SearchableSelect
                                      options={grocyProductOptions}
                                      value={mapping?.grocyProductId ?? null}
                                      onChange={val => {
                                        const gp = data.grocyProducts.find(p => p.id === val);
                                        setProductMaps(prev => ({
                                          ...prev,
                                          [food.id]: {
                                            ...prev[food.id],
                                            grocyProductId: val,
                                            grocyUnitId: gp?.quIdPurchase || prev[food.id]?.grocyUnitId || null,
                                          },
                                        }));
                                      }}
                                      placeholder="Select Grocy product..."
                                      style={{ maxWidth: 280 }}
                                    />
                                  </td>
                                  <td style={td}>
                                    <SearchableSelect
                                      options={grocyUnitOptions}
                                      value={mapping?.grocyUnitId ?? null}
                                      onChange={val => setProductMaps(prev => ({
                                        ...prev,
                                        [food.id]: { ...prev[food.id], grocyUnitId: val },
                                      }))}
                                      placeholder="Unit..."
                                      style={{ maxWidth: 180 }}
                                    />
                                  </td>
                                  <td style={td}>
                                    {suggestion && !isAccepted ? (
                                      <button
                                        style={{ ...btnSecondary, padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                        onClick={() => acceptProductSuggestion(food.id)}
                                        title={`Accept: ${suggestion.grocyProductName}`}
                                      >
                                        <span style={badge(suggestion.score)}>{suggestion.score}%</span>
                                      </button>
                                    ) : suggestion ? (
                                      <span style={badge(suggestion.score)}>{suggestion.score}%</span>
                                    ) : null}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* Product action buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem', alignItems: 'center' }}>
                    <button style={btnPrimary} onClick={syncProducts} disabled={isRunning || productMappedCount === 0}>
                      {actionRunning === 'syncProducts' ? 'Syncing...' : `Sync Mapped (${productMappedCount})`}
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <SearchableSelect
                        options={grocyUnitOptions}
                        value={defaultCreateUnitId}
                        onChange={setDefaultCreateUnitId}
                        placeholder="Default unit..."
                        style={{ minWidth: 160 }}
                      />
                      <button style={btnSecondary} onClick={createUnmappedProducts} disabled={isRunning || !defaultCreateUnitId}>
                        {actionRunning === 'createProducts' ? 'Creating...' : 'Create Unmapped in Grocy'}
                      </button>
                    </div>
                    <button
                      style={btnDanger}
                      onClick={() => setConfirmAction('deleteOrphanProducts')}
                      disabled={isRunning || data.orphanGrocyProductCount === 0}
                    >
                      Delete Grocy Orphans ({data.orphanGrocyProductCount})
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Confirmation Dialogs */}
          <ConfirmDialog
            action="deleteOrphanProducts"
            label={`Delete ${data?.orphanGrocyProductCount ?? 0} orphan Grocy products that have no Mealie counterpart?`}
            onConfirm={deleteOrphanProducts}
          />
          <ConfirmDialog
            action="deleteOrphanUnits"
            label={`Delete ${data?.orphanGrocyUnitCount ?? 0} orphan Grocy units that have no Mealie counterpart?`}
            onConfirm={deleteOrphanUnits}
          />
        </div>
      </div>
    </>
  );
}

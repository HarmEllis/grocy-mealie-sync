'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import SearchableSelect from './searchable-select';
import ConfirmDialog from './confirm-dialog';

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

const tabBar: React.CSSProperties = {
  display: 'flex', gap: '0.25rem', borderBottom: '2px solid #e0e0e0', marginBottom: '1rem',
};
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' };
const th: React.CSSProperties = { textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #ddd', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '0.4rem 0.5rem', borderBottom: '1px solid #eee', verticalAlign: 'middle' };
const searchInput: React.CSSProperties = {
  padding: '0.4rem 0.6rem', fontSize: '0.9rem', border: '1px solid #d1d5db', borderRadius: 6,
  width: '100%', maxWidth: 300,
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

const sortByName = <T extends { name: string }>(items: T[]) => [...items].sort((a, b) => a.name.localeCompare(b.name));

// --- Component ---

export default function MappingWizard() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'products' | 'units'>('units');
  const [data, setData] = useState<WizardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionRunning, setActionRunning] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [productSearch, setProductSearch] = useState('');
  const [unitSearch, setUnitSearch] = useState('');

  // Confirm dialog state
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmDescription, setConfirmDescription] = useState('This action cannot be undone.');
  const [confirmItemNames, setConfirmItemNames] = useState<string[]>([]);
  const [confirmCallback, setConfirmCallback] = useState<(() => void) | null>(null);

  const [productMaps, setProductMaps] = useState<Record<string, ProductMapping>>({});
  const [unitMaps, setUnitMaps] = useState<Record<string, UnitMapping>>({});
  const [defaultCreateUnitId, setDefaultCreateUnitId] = useState<number | null>(null);
  const [createProductChecked, setCreateProductChecked] = useState<Record<string, boolean>>({});
  const [createUnitChecked, setCreateUnitChecked] = useState<Record<string, boolean>>({});

  // setTimeout cleanup (L5)
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    };
  }, []);

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
      showMessage('Failed to load mapping data', 'error');
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

  // Unmapped IDs (no Grocy mapping selected) -- eligible for "create" checkboxes
  const unmappedProductIds = useMemo(() =>
    Object.entries(productMaps).filter(([, m]) => m.grocyProductId === null).map(([id]) => id),
    [productMaps],
  );
  const unmappedUnitIds = useMemo(() =>
    Object.entries(unitMaps).filter(([, m]) => m.grocyUnitId === null).map(([id]) => id),
    [unitMaps],
  );
  const checkedProductCount = unmappedProductIds.filter(id => createProductChecked[id]).length;
  const checkedUnitCount = unmappedUnitIds.filter(id => createUnitChecked[id]).length;

  // For select-all in header: only toggle visible (filtered) unmapped items
  const visibleUnmappedProductIds = useMemo(() => {
    const unmappedSet = new Set(unmappedProductIds);
    return filteredFoods.filter(f => unmappedSet.has(f.id)).map(f => f.id);
  }, [unmappedProductIds, filteredFoods]);
  const visibleUnmappedUnitIds = useMemo(() => {
    const unmappedSet = new Set(unmappedUnitIds);
    return filteredUnits.filter(u => unmappedSet.has(u.id)).map(u => u.id);
  }, [unmappedUnitIds, filteredUnits]);
  const allVisibleProductsChecked = visibleUnmappedProductIds.length > 0 && visibleUnmappedProductIds.every(id => createProductChecked[id]);
  const allVisibleUnitsChecked = visibleUnmappedUnitIds.length > 0 && visibleUnmappedUnitIds.every(id => createUnitChecked[id]);

  function showMessage(msg: string, type: 'success' | 'error' | 'info' = 'success') {
    setMessage(msg);
    setMessageType(type);
    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    messageTimeoutRef.current = setTimeout(() => setMessage(''), 5000);
  }

  function openConfirm(action: string, title: string, onConfirm: () => void, itemNames: string[] = [], description = 'This action cannot be undone.') {
    setConfirmAction(action);
    setConfirmTitle(title);
    setConfirmDescription(description);
    setConfirmItemNames(itemNames);
    // Wrap in a function-returning-function so React setState doesn't call it
    setConfirmCallback(() => onConfirm);
  }

  function closeConfirm() {
    setConfirmAction(null);
    setConfirmCallback(null);
    setConfirmItemNames([]);
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
      showMessage(String(e), 'error');
    } finally {
      setActionRunning(null);
      closeConfirm();
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
    if (filled.length === 0) { showMessage('No products mapped', 'info'); return; }

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

      // Check remaining unmapped after refresh -- if 0, prompt to enable auto-create (M17)
      const checkRes = await fetch('/api/mapping-wizard/data');
      const checkData: WizardData = await checkRes.json();
      if (checkData.unmappedMealieFoods.length === 0) {
        showMessage(`Synced ${result.synced} products, renamed ${result.renamed}`);
        promptAutoCreate('autoCreateProducts', `All products are now mapped. Enable auto-create for future products?`);
      } else {
        showMessage(`Synced ${result.synced} products, renamed ${result.renamed}`);
      }
    });
  }

  async function createUnmappedProducts() {
    if (!data) return;
    const checkedIds = unmappedProductIds.filter(id => createProductChecked[id]);
    if (checkedIds.length === 0) { showMessage('No products checked for creation', 'info'); return; }
    if (!defaultCreateUnitId) { showMessage('Select a default unit first', 'info'); return; }
    const unmappedIds = checkedIds;

    await runAction('createProducts', async () => {
      const res = await fetch('/api/mapping-wizard/products/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealieFoodIds: unmappedIds,
          defaultGrocyUnitId: defaultCreateUnitId,
          unitOverrides: Object.fromEntries(
            unmappedIds
              .filter(id => productMaps[id]?.grocyUnitId != null)
              .map(id => [id, productMaps[id].grocyUnitId]),
          ),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      const checkRes = await fetch('/api/mapping-wizard/data');
      const checkData: WizardData = await checkRes.json();
      if (checkData.unmappedMealieFoods.length === 0) {
        showMessage(`Created ${result.created} products`);
        promptAutoCreate('autoCreateProducts', `All products are now mapped. Enable auto-create for future products?`);
      } else {
        showMessage(`Created ${result.created} products${result.skipped ? `, ${result.skipped} skipped` : ''}`);
      }
    });
  }

  async function deleteOrphanProducts(orphanNames: string[], orphanIds: string[]) {
    await runAction('deleteOrphanProducts', async () => {
      if (orphanIds.length === 0) { showMessage('No orphan products to delete', 'info'); return; }

      const res = await fetch('/api/mapping-wizard/products/orphans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, ids: orphanIds }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      showMessage(`Deleted ${result.deleted} orphan products`);
    });
  }

  async function handleDeleteOrphanProducts() {
    // Fetch orphan list first to get names (M15)
    try {
      const listRes = await fetch('/api/mapping-wizard/products/orphans');
      const listData = await listRes.json();
      if (!listRes.ok) throw new Error(listData.error);
      if (listData.orphans.length === 0) { showMessage('No orphan products to delete', 'info'); return; }

      const names = listData.orphans.map((o: { id: string; name: string }) => o.name || o.id);
      const ids = listData.orphans.map((o: { id: string }) => o.id);
      openConfirm(
        'deleteOrphanProducts',
        `Delete ${listData.orphans.length} orphan Grocy products that have no Mealie counterpart?`,
        () => deleteOrphanProducts(names, ids),
        names,
      );
    } catch {
      showMessage('Failed to fetch orphan products', 'error');
    }
  }

  // --- Unit Actions ---

  async function syncUnits() {
    const filled = Object.values(unitMaps).filter(m => m.grocyUnitId !== null);
    if (filled.length === 0) { showMessage('No units mapped', 'info'); return; }

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
        showMessage(`Synced ${result.synced} units, renamed ${result.renamed}`);
        promptAutoCreate('autoCreateUnits', `All units are now mapped. Enable auto-create for future units?`);
      } else {
        showMessage(`Synced ${result.synced} units, renamed ${result.renamed}`);
      }
    });
  }

  async function createUnmappedUnits() {
    if (!data) return;
    const checkedIds = unmappedUnitIds.filter(id => createUnitChecked[id]);
    if (checkedIds.length === 0) { showMessage('No units checked for creation', 'info'); return; }
    const unmappedIds = checkedIds;

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
        showMessage(`Created ${result.created} units`);
        promptAutoCreate('autoCreateUnits', `All units are now mapped. Enable auto-create for future units?`);
      } else {
        showMessage(`Created ${result.created} units${result.skipped ? `, ${result.skipped} skipped` : ''}`);
      }
    });
  }

  async function deleteOrphanUnits(orphanNames: string[], orphanIds: string[]) {
    await runAction('deleteOrphanUnits', async () => {
      if (orphanIds.length === 0) { showMessage('No orphan units to delete', 'info'); return; }

      const res = await fetch('/api/mapping-wizard/units/orphans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, ids: orphanIds }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      showMessage(`Deleted ${result.deleted} orphan units`);
    });
  }

  async function handleDeleteOrphanUnits() {
    // Fetch orphan list first to get names (M15)
    try {
      const listRes = await fetch('/api/mapping-wizard/units/orphans');
      const listData = await listRes.json();
      if (!listRes.ok) throw new Error(listData.error);
      if (listData.orphans.length === 0) { showMessage('No orphan units to delete', 'info'); return; }

      const names = listData.orphans.map((o: { id: string; name: string }) => o.name || o.id);
      const ids = listData.orphans.map((o: { id: string }) => o.id);
      openConfirm(
        'deleteOrphanUnits',
        `Delete ${listData.orphans.length} orphan Grocy units that have no Mealie counterpart?`,
        () => deleteOrphanUnits(names, ids),
        names,
      );
    } catch {
      showMessage('Failed to fetch orphan units', 'error');
    }
  }

  // --- Auto-create confirmation gate (M17) ---

  function promptAutoCreate(field: 'autoCreateProducts' | 'autoCreateUnits', msg: string) {
    const label = field === 'autoCreateProducts' ? 'products' : 'units';
    openConfirm(
      `autoCreate_${field}`,
      msg,
      () => {
        enableAutoCreate(field);
        showMessage(`Auto-create ${label} enabled`);
        closeConfirm();
      },
      [],
      `This will automatically create new ${label} in Grocy when they appear in Mealie.`,
    );
  }

  // --- Render ---

  const isRunning = !!actionRunning;
  const productMappedCount = Object.values(productMaps).filter(m => m.grocyProductId !== null).length;
  const unitMappedCount = Object.values(unitMaps).filter(m => m.grocyUnitId !== null).length;
  const defaultUnitName = defaultCreateUnitId && data
    ? data.grocyUnits.find(u => u.id === defaultCreateUnitId)?.name
    : undefined;
  const unitPlaceholder = defaultUnitName ? `Default: ${defaultUnitName}` : 'Unit...';

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ ...btnPrimary, marginTop: '0.5rem', opacity: open ? 0.7 : 1 }}>
        {open ? 'Mapping Wizard (Open)' : 'Mapping Wizard'}
      </button>

      <Dialog.Root open={open} onOpenChange={val => { if (!val && !isRunning) setOpen(false); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content" aria-describedby="wizard-desc">
            <Dialog.Title style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>
              Mapping Wizard
            </Dialog.Title>
            <p id="wizard-desc" style={{ color: '#666', fontSize: '0.9rem', margin: '0 0 1rem' }}>
              Map Mealie items to existing Grocy items, or create new ones. Start with units, then products.
            </p>
            <Dialog.Close asChild>
              <button
                style={{
                  position: 'absolute', top: '0.75rem', right: '1rem', background: 'none',
                  border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#666',
                }}
                aria-label="Close"
                disabled={isRunning}
              >
                &times;
              </button>
            </Dialog.Close>

            {message && (
              <div
                className={`status-message status-message--${messageType}`}
                style={{ marginBottom: '1rem' }}
              >
                {message}
              </div>
            )}

            {loading ? (
              <p>Loading data from Mealie and Grocy...</p>
            ) : !data ? (
              <p style={{ color: '#991b1b' }}>Failed to load data. Check API connections.</p>
            ) : (
              <Tabs.Root value={tab} onValueChange={val => setTab(val as 'units' | 'products')}>
                <Tabs.List style={tabBar} aria-label="Mapping categories">
                  <Tabs.Trigger
                    value="units"
                    style={{
                      padding: '0.5rem 1.25rem', cursor: 'pointer',
                      fontWeight: tab === 'units' ? 'bold' : 'normal',
                      borderBottom: tab === 'units' ? '2px solid #333' : '2px solid transparent',
                      marginBottom: -2, background: 'none', border: 'none', fontSize: '1rem',
                    }}
                  >
                    Units ({data.unmappedMealieUnits.length} unmapped)
                  </Tabs.Trigger>
                  <Tabs.Trigger
                    value="products"
                    style={{
                      padding: '0.5rem 1.25rem', cursor: 'pointer',
                      fontWeight: tab === 'products' ? 'bold' : 'normal',
                      borderBottom: tab === 'products' ? '2px solid #333' : '2px solid transparent',
                      marginBottom: -2, background: 'none', border: 'none', fontSize: '1rem',
                    }}
                  >
                    Products ({data.unmappedMealieFoods.length} unmapped)
                  </Tabs.Trigger>
                </Tabs.List>

                {/* === UNITS TAB === */}
                <Tabs.Content value="units">
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
                                <th style={{ ...th, width: 36, textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={allVisibleUnitsChecked}
                                    onChange={e => {
                                      const checked = e.target.checked;
                                      setCreateUnitChecked(prev => {
                                        const next = { ...prev };
                                        for (const id of visibleUnmappedUnitIds) next[id] = checked;
                                        return next;
                                      });
                                    }}
                                    title={allVisibleUnitsChecked ? 'Deselect all for creation' : 'Select all for creation'}
                                  />
                                </th>
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
                                    <td style={{ ...td, textAlign: 'center' }}>
                                      {!isAccepted && (
                                        <input
                                          type="checkbox"
                                          checked={!!createUnitChecked[unit.id]}
                                          onChange={e => setCreateUnitChecked(prev => ({ ...prev, [unit.id]: e.target.checked }))}
                                          title="Create this unit in Grocy"
                                        />
                                      )}
                                    </td>
                                    <td style={td}><strong>{unit.name}</strong></td>
                                    <td style={{ ...td, color: '#666' }}>{unit.abbreviation || '-'}</td>
                                    <td style={td}>
                                      <SearchableSelect
                                        options={grocyUnitOptions}
                                        value={mapping?.grocyUnitId ?? null}
                                        onChange={val => {
                                          setUnitMaps(prev => ({ ...prev, [unit.id]: { ...prev[unit.id], grocyUnitId: val } }));
                                          if (val !== null) {
                                            setCreateUnitChecked(prev => { const next = { ...prev }; delete next[unit.id]; return next; });
                                          }
                                        }}
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
                      <button style={btnSecondary} onClick={createUnmappedUnits} disabled={isRunning || checkedUnitCount === 0}>
                        {actionRunning === 'createUnits' ? 'Creating...' : `Create Checked in Grocy (${checkedUnitCount})`}
                      </button>
                      <button
                        style={btnDanger}
                        onClick={handleDeleteOrphanUnits}
                        disabled={isRunning || data.orphanGrocyUnitCount === 0}
                      >
                        Delete Grocy Orphans ({data.orphanGrocyUnitCount})
                      </button>
                    </div>
                  </div>
                </Tabs.Content>

                {/* === PRODUCTS TAB === */}
                <Tabs.Content value="products">
                  <div>
                    {data.unmappedMealieFoods.length === 0 ? (
                      <p style={{ color: '#166534', background: '#dcfce7', padding: '0.75rem 1rem', borderRadius: 6 }}>
                        All Mealie products are mapped. Auto-sync will handle new products from here.
                      </p>
                    ) : (
                      <>
                        {/* Default unit setting */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.5rem 0.75rem', marginBottom: '0.75rem',
                          background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6,
                        }}>
                          <label style={{ fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>
                            Default unit for new products:
                          </label>
                          <SearchableSelect
                            options={grocyUnitOptions}
                            value={defaultCreateUnitId}
                            onChange={setDefaultCreateUnitId}
                            placeholder="Select unit..."
                            style={{ minWidth: 160, maxWidth: 220 }}
                          />
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                            Used when unit column is empty
                          </span>
                        </div>

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
                                <th style={{ ...th, width: 36, textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={allVisibleProductsChecked}
                                    onChange={e => {
                                      const checked = e.target.checked;
                                      setCreateProductChecked(prev => {
                                        const next = { ...prev };
                                        for (const id of visibleUnmappedProductIds) next[id] = checked;
                                        return next;
                                      });
                                    }}
                                    title={allVisibleProductsChecked ? 'Deselect all for creation' : 'Select all for creation'}
                                  />
                                </th>
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
                                    <td style={{ ...td, textAlign: 'center' }}>
                                      {!isAccepted && (
                                        <input
                                          type="checkbox"
                                          checked={!!createProductChecked[food.id]}
                                          onChange={e => setCreateProductChecked(prev => ({ ...prev, [food.id]: e.target.checked }))}
                                          title="Create this product in Grocy"
                                        />
                                      )}
                                    </td>
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
                                          if (val !== null) {
                                            setCreateProductChecked(prev => { const next = { ...prev }; delete next[food.id]; return next; });
                                          }
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
                                        placeholder={unitPlaceholder}
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
                      <button style={btnSecondary} onClick={createUnmappedProducts} disabled={isRunning || !defaultCreateUnitId || checkedProductCount === 0}>
                        {actionRunning === 'createProducts' ? 'Creating...' : `Create Checked in Grocy (${checkedProductCount})`}
                      </button>
                      <button
                        style={btnDanger}
                        onClick={handleDeleteOrphanProducts}
                        disabled={isRunning || data.orphanGrocyProductCount === 0}
                      >
                        Delete Grocy Orphans ({data.orphanGrocyProductCount})
                      </button>
                    </div>
                  </div>
                </Tabs.Content>
              </Tabs.Root>
            )}

            {/* Confirmation Dialog */}
            <ConfirmDialog
              open={confirmAction !== null}
              onClose={closeConfirm}
              onConfirm={() => confirmCallback?.()}
              title={confirmTitle}
              description={confirmDescription}
              itemNames={confirmItemNames}
              running={isRunning}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

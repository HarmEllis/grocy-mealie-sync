'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Wand2, Loader2, Link, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { GrocyMinStockProductsTab } from './GrocyMinStockProductsTab';
import { UnitsTab } from './UnitsTab';
import { ProductsTab } from './ProductsTab';
import type { GrocyMinStockProductMapping, ProductMapping, UnitMapping, WizardData } from './types';
import { sortByName } from './types';
import {
  buildGrocyMinStockProductMaps,
  buildProductMaps,
  buildUnitMaps,
  getDefaultWizardTab,
  mergeCheckedState,
  mergeGrocyMinStockProductMaps,
  mergeProductMaps,
  mergeUnitMaps,
} from './state';

interface FetchDataOptions {
  preserveWizardState?: boolean;
  showLoading?: boolean;
}

export function MappingWizard() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'products' | 'units' | 'grocy-min-stock'>('units');
  const [data, setData] = useState<WizardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionRunning, setActionRunning] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [grocyMinStockProductSearch, setGrocyMinStockProductSearch] = useState('');
  const [unitSearch, setUnitSearch] = useState('');

  // Confirm dialog state
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmDescription, setConfirmDescription] = useState('This action cannot be undone.');
  const [confirmItemNames, setConfirmItemNames] = useState<string[]>([]);
  const [confirmCallback, setConfirmCallback] = useState<(() => void) | null>(null);

  const [productMaps, setProductMaps] = useState<Record<string, ProductMapping>>({});
  const [grocyMinStockProductMaps, setGrocyMinStockProductMaps] = useState<Record<string, GrocyMinStockProductMapping>>({});
  const [unitMaps, setUnitMaps] = useState<Record<string, UnitMapping>>({});
  const [defaultCreateUnitId, setDefaultCreateUnitId] = useState<number | null>(null);
  const [createProductChecked, setCreateProductChecked] = useState<Record<string, boolean>>({});
  const [createMealieProductChecked, setCreateMealieProductChecked] = useState<Record<string, boolean>>({});
  const [createUnitChecked, setCreateUnitChecked] = useState<Record<string, boolean>>({});

  // setTimeout cleanup
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    };
  }, []);

  const fetchData = useCallback(async ({
    preserveWizardState = false,
    showLoading = true,
  }: FetchDataOptions = {}) => {
    if (showLoading) {
      setLoading(true);
    }

    try {
      const res = await fetch('/api/mapping-wizard/data');
      if (!res.ok) throw new Error('Failed to fetch');
      const d: WizardData = await res.json();
      setData(d);

      if (preserveWizardState) {
        setProductMaps(prev => mergeProductMaps(d, prev));
        setGrocyMinStockProductMaps(prev => mergeGrocyMinStockProductMaps(d, prev));
        setUnitMaps(prev => mergeUnitMaps(d, prev));
        setCreateProductChecked(prev => mergeCheckedState(d.unmappedMealieFoods.map(food => food.id), prev));
        setCreateMealieProductChecked(prev => mergeCheckedState(d.unmappedGrocyMinStockProducts.map(product => product.id), prev));
        setCreateUnitChecked(prev => mergeCheckedState(d.unmappedMealieUnits.map(unit => unit.id), prev));
      } else {
        setProductMaps(buildProductMaps(d));
        setGrocyMinStockProductMaps(buildGrocyMinStockProductMaps(d));
        setUnitMaps(buildUnitMaps(d));
        setCreateProductChecked({});
        setCreateMealieProductChecked({});
        setCreateUnitChecked({});
        setTab(getDefaultWizardTab(d));
      }

      setDefaultCreateUnitId(prev => prev ?? (d.grocyUnits[0]?.id ?? null));
      return d;
    } catch {
      toast.error('Failed to load mapping data');
      return null;
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (open) {
      void fetchData();
    }
  }, [open, fetchData]);

  // Sorted options for SearchableSelect
  const grocyProductOptions = useMemo(() =>
    data ? sortByName(data.grocyProducts).map(p => ({ value: p.id, label: p.name })) : [],
    [data],
  );
  const mealieProductOptions = useMemo(() =>
    data ? sortByName(data.unmappedMealieFoods).map(food => ({ value: food.id, label: food.name })) : [],
    [data],
  );
  const grocyUnitOptions = useMemo(() =>
    data ? sortByName(data.grocyUnits).map(u => ({ value: u.id, label: u.name })) : [],
    [data],
  );
  // Only already-mapped units for the "default unit" dropdown (matches Settings behavior)
  const mappedUnitOptions = useMemo(() =>
    data ? sortByName(data.existingUnitMappings.map(m => ({ name: m.mealieUnitName, id: m.grocyUnitId }))).map(u => ({ value: u.id, label: u.name })) : [],
    [data],
  );

  // Unmapped IDs for "create" checkboxes
  const unmappedProductIds = useMemo(() =>
    Object.entries(productMaps).filter(([, m]) => m.grocyProductId === null).map(([id]) => id),
    [productMaps],
  );
  const unmappedGrocyMinStockProductIds = useMemo(() =>
    Object.entries(grocyMinStockProductMaps).filter(([, m]) => m.mealieFoodId === null).map(([id]) => id),
    [grocyMinStockProductMaps],
  );
  const unmappedUnitIds = useMemo(() =>
    Object.entries(unitMaps).filter(([, m]) => m.grocyUnitId === null).map(([id]) => id),
    [unitMaps],
  );

  // --- Helpers ---

  function openConfirm(action: string, title: string, onConfirm: () => void, itemNames: string[] = [], description = 'This action cannot be undone.') {
    setConfirmAction(action);
    setConfirmTitle(title);
    setConfirmDescription(description);
    setConfirmItemNames(itemNames);
    setConfirmCallback(() => onConfirm);
  }

  function closeConfirm() {
    setConfirmAction(null);
    setConfirmCallback(null);
    setConfirmItemNames([]);
  }

  async function enableAutoCreate(field: 'autoCreateProducts' | 'autoCreateUnits'): Promise<boolean> {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: true }),
    });

    if (!res.ok) {
      const result = await res.json().catch(() => null);
      throw new Error(result?.error || 'Failed to update setting');
    }

    return true;
  }

  async function runAction(name: string, fn: () => Promise<void>) {
    setActionRunning(name);
    try {
      await fn();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setActionRunning(null);
      closeConfirm();
    }
  }

  function promptAutoCreate(field: 'autoCreateProducts' | 'autoCreateUnits', msg: string) {
    const label = field === 'autoCreateProducts' ? 'products' : 'units';
    openConfirm(
      `autoCreate_${field}`,
      msg,
      () => {
        void runAction(`autoCreate_${field}`, async () => {
          await enableAutoCreate(field);
          toast.success(`Auto-create ${label} enabled`);
        });
      },
      [],
      `This will automatically create new ${label} in Grocy when they appear in Mealie.`,
    );
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

  function acceptAllGrocyMinStockProductSuggestions() {
    if (!data) return;
    setGrocyMinStockProductMaps(prev => {
      const next = { ...prev };
      for (const product of data.unmappedGrocyMinStockProducts) {
        const suggestion = data.lowStockGrocyProductSuggestions[String(product.id)];
        if (suggestion) {
          next[String(product.id)] = {
            grocyProductId: product.id,
            mealieFoodId: suggestion.mealieFoodId,
            grocyUnitId: product.quIdPurchase || null,
          };
        }
      }
      return next;
    });
  }

  function acceptGrocyMinStockProductSuggestion(grocyProductId: number) {
    if (!data) return;
    const suggestion = data.lowStockGrocyProductSuggestions[String(grocyProductId)];
    const grocyProduct = data.unmappedGrocyMinStockProducts.find(product => product.id === grocyProductId);
    if (!suggestion || !grocyProduct) return;

    setGrocyMinStockProductMaps(prev => ({
      ...prev,
      [String(grocyProductId)]: {
        grocyProductId,
        mealieFoodId: suggestion.mealieFoodId,
        grocyUnitId: grocyProduct.quIdPurchase || null,
      },
    }));
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

  async function normalizeProducts() {
    await runAction('normalizeProducts', async () => {
      const res = await fetch('/api/mapping-wizard/products/normalize', { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to normalize products');
      await fetchData({ preserveWizardState: true, showLoading: false });
      const skipped = result.skippedDuplicates?.length ?? 0;
      toast.success(`Normalized ${result.normalizedMealie} Mealie products and ${result.normalizedGrocy} Grocy products${skipped ? `, ${skipped} skipped` : ''}`);
      if (skipped) toast.warning(`${skipped} products skipped: a product with the target name already exists in Mealie (duplicates with different casing or trailing spaces). Remove the duplicate in Mealie first.`, { duration: 15000 });
    });
  }

  async function syncProducts() {
    const filled = Object.values(productMaps).filter(m => m.grocyProductId !== null);
    if (filled.length === 0) { toast.info('No products mapped'); return; }

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

      const refreshedData = await fetchData({ preserveWizardState: true, showLoading: false });
      if (refreshedData?.unmappedMealieFoods.length === 0) {
        toast.success(`Synced ${result.synced} products, renamed ${result.renamed}`);
        promptAutoCreate('autoCreateProducts', `All products are now mapped. Enable auto-create for future products?`);
      } else {
        toast.success(`Synced ${result.synced} products, renamed ${result.renamed}`);
      }
    });
  }

  async function createUnmappedProducts() {
    if (!data) return;
    const checkedIds = unmappedProductIds.filter(id => createProductChecked[id]);
    if (checkedIds.length === 0) { toast.info('No products checked for creation'); return; }
    if (!defaultCreateUnitId) { toast.info('Select a default unit first'); return; }

    await runAction('createProducts', async () => {
      const res = await fetch('/api/mapping-wizard/products/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealieFoodIds: checkedIds,
          defaultGrocyUnitId: defaultCreateUnitId,
          unitOverrides: Object.fromEntries(
            checkedIds
              .filter(id => productMaps[id]?.grocyUnitId != null)
              .map(id => [id, productMaps[id].grocyUnitId]),
          ),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      const refreshedData = await fetchData({ preserveWizardState: true, showLoading: false });
      if (refreshedData?.unmappedMealieFoods.length === 0) {
        toast.success(`Created ${result.created} products`);
        promptAutoCreate('autoCreateProducts', `All products are now mapped. Enable auto-create for future products?`);
      } else {
        toast.success(`Created ${result.created} products${result.skipped ? `, ${result.skipped} skipped` : ''}`);
      }
    });
  }

  async function syncGrocyMinStockProducts() {
    const filled = Object.values(grocyMinStockProductMaps).filter((
      mapping,
    ): mapping is GrocyMinStockProductMapping & { mealieFoodId: string } => mapping.mealieFoodId !== null);
    if (filled.length === 0) {
      toast.info('No Grocy min-stock products mapped');
      return;
    }

    await runAction('syncGrocyMinStockProducts', async () => {
      const res = await fetch('/api/mapping-wizard/products/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mappings: filled.map(mapping => ({
            mealieFoodId: mapping.mealieFoodId,
            grocyProductId: mapping.grocyProductId,
            grocyUnitId: mapping.grocyUnitId || 0,
          })),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to sync products');

      await fetchData({ preserveWizardState: true, showLoading: false });
      toast.success(`Synced ${result.synced} products, renamed ${result.renamed}`);
    });
  }

  async function createMealieProductsFromGrocy() {
    const checkedIds = unmappedGrocyMinStockProductIds.filter(id => createMealieProductChecked[id]).map(Number);
    if (checkedIds.length === 0) {
      toast.info('No Grocy products checked for creation');
      return;
    }

    await runAction('createMealieProducts', async () => {
      const res = await fetch('/api/mapping-wizard/products/create-mealie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grocyProductIds: checkedIds,
          unitSelections: Object.fromEntries(
            checkedIds.map(id => [String(id), grocyMinStockProductMaps[String(id)]?.grocyUnitId ?? null]),
          ),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to create Mealie products');

      await fetchData({ preserveWizardState: true, showLoading: false });
      toast.success(`Created ${result.created} Mealie products${result.skipped ? `, ${result.skipped} skipped` : ''}`);
    });
  }

  async function deleteOrphanProducts(orphanNames: string[], orphanIds: string[]) {
    await runAction('deleteOrphanProducts', async () => {
      if (orphanIds.length === 0) { toast.info('No orphan products to delete'); return; }

      const res = await fetch('/api/mapping-wizard/products/orphans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, ids: orphanIds }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      await fetchData({ preserveWizardState: true, showLoading: false });
      toast.success(`Deleted ${result.deleted} orphan products`);
    });
  }

  async function handleDeleteOrphanProducts() {
    try {
      const listRes = await fetch('/api/mapping-wizard/products/orphans');
      const listData = await listRes.json();
      if (!listRes.ok) throw new Error(listData.error);
      if (listData.orphans.length === 0) { toast.info('No orphan products to delete'); return; }

      const names = listData.orphans.map((o: { id: string; name: string }) => o.name || o.id);
      const ids = listData.orphans.map((o: { id: string }) => o.id);
      openConfirm(
        'deleteOrphanProducts',
        `Delete ${listData.orphans.length} orphan Grocy products that have no Mealie counterpart?`,
        () => deleteOrphanProducts(names, ids),
        names,
      );
    } catch {
      toast.error('Failed to fetch orphan products');
    }
  }

  // --- Unit Actions ---

  async function normalizeUnits() {
    await runAction('normalizeUnits', async () => {
      const res = await fetch('/api/mapping-wizard/units/normalize', { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to normalize units');
      await fetchData({ preserveWizardState: true, showLoading: false });
      const skipped = result.skippedDuplicates?.length ?? 0;
      toast.success(`Normalized ${result.normalizedMealie} Mealie units and ${result.normalizedGrocy} Grocy units${skipped ? `, ${skipped} skipped` : ''}`);
      if (skipped) toast.warning(`${skipped} units skipped: a unit with the target name already exists in Mealie (duplicates with different casing or trailing spaces). Remove the duplicate in Mealie first.`, { duration: 15000 });
    });
  }

  async function syncUnits() {
    const filled = Object.values(unitMaps).filter(m => m.grocyUnitId !== null);
    if (filled.length === 0) { toast.info('No units mapped'); return; }

    await runAction('syncUnits', async () => {
      const res = await fetch('/api/mapping-wizard/units/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: filled.map(m => ({ mealieUnitId: m.mealieUnitId, grocyUnitId: m.grocyUnitId })) }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      const refreshedData = await fetchData({ preserveWizardState: true, showLoading: false });
      if (refreshedData?.unmappedMealieUnits.length === 0) {
        toast.success(`Synced ${result.synced} units, renamed ${result.renamed}`);
        promptAutoCreate('autoCreateUnits', `All units are now mapped. Enable auto-create for future units?`);
      } else {
        toast.success(`Synced ${result.synced} units, renamed ${result.renamed}`);
      }
    });
  }

  async function createUnmappedUnits() {
    if (!data) return;
    const checkedIds = unmappedUnitIds.filter(id => createUnitChecked[id]);
    if (checkedIds.length === 0) { toast.info('No units checked for creation'); return; }

    await runAction('createUnits', async () => {
      const res = await fetch('/api/mapping-wizard/units/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealieUnitIds: checkedIds }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      const refreshedData = await fetchData({ preserveWizardState: true, showLoading: false });
      if (refreshedData?.unmappedMealieUnits.length === 0) {
        toast.success(`Created ${result.created} units`);
        promptAutoCreate('autoCreateUnits', `All units are now mapped. Enable auto-create for future units?`);
      } else {
        toast.success(`Created ${result.created} units${result.skipped ? `, ${result.skipped} skipped` : ''}`);
      }
    });
  }

  async function deleteOrphanUnits(orphanNames: string[], orphanIds: string[]) {
    await runAction('deleteOrphanUnits', async () => {
      if (orphanIds.length === 0) { toast.info('No orphan units to delete'); return; }

      const res = await fetch('/api/mapping-wizard/units/orphans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, ids: orphanIds }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      await fetchData({ preserveWizardState: true, showLoading: false });
      toast.success(`Deleted ${result.deleted} orphan units`);
    });
  }

  async function handleDeleteOrphanUnits() {
    try {
      const listRes = await fetch('/api/mapping-wizard/units/orphans');
      const listData = await listRes.json();
      if (!listRes.ok) throw new Error(listData.error);
      if (listData.orphans.length === 0) { toast.info('No orphan units to delete'); return; }

      const names = listData.orphans.map((o: { id: string; name: string }) => o.name || o.id);
      const ids = listData.orphans.map((o: { id: string }) => o.id);
      openConfirm(
        'deleteOrphanUnits',
        `Delete ${listData.orphans.length} orphan Grocy units that have no Mealie counterpart?`,
        () => deleteOrphanUnits(names, ids),
        names,
      );
    } catch {
      toast.error('Failed to fetch orphan units');
    }
  }

  // --- Render ---

  const isRunning = !!actionRunning;

  return (
    <>
      <Button onClick={() => setOpen(true)} className={open ? 'opacity-70' : ''}>
        <Wand2 className="size-4" />
        {open ? 'Mapping Wizard (Open)' : 'Mapping Wizard'}
      </Button>

      <Dialog open={open} onOpenChange={val => { if (!val && !isRunning) setOpen(false); }}>
        <DialogContent className="h-[85vh] max-h-[85vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden flex flex-col sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Mapping Wizard</DialogTitle>
            <DialogDescription>
              Map Mealie items to existing Grocy items, or create new ones. Start with units, then products.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {loading ? (
              <div className="space-y-3 py-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-8 w-64" />
              </div>
            ) : !data ? (
              <p className="text-sm text-destructive py-4">
                Failed to load data. Check API connections.
              </p>
            ) : (
              <Tabs className="min-h-0 min-w-0 flex-1" value={tab} onValueChange={val => setTab(val as 'units' | 'products' | 'grocy-min-stock')}>
                <div className="-mx-1 overflow-x-auto pb-1">
                  <TabsList variant="line" className="min-w-max px-1">
                    <TabsTrigger value="units">
                      Units ({data.unmappedMealieUnits.length} unmapped)
                    </TabsTrigger>
                    <TabsTrigger value="products">
                      Products ({data.unmappedMealieFoods.length} unmapped)
                    </TabsTrigger>
                    <TabsTrigger value="grocy-min-stock">
                      Grocy Min Stock ({data.unmappedGrocyMinStockProducts.length} unmapped)
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="units" className="mt-4 flex min-h-0 min-w-0 flex-1">
                  <UnitsTab
                    data={data}
                    unitMaps={unitMaps}
                    setUnitMaps={setUnitMaps}
                    createUnitChecked={createUnitChecked}
                    setCreateUnitChecked={setCreateUnitChecked}
                    unitSearch={unitSearch}
                    setUnitSearch={setUnitSearch}
                    grocyUnitOptions={grocyUnitOptions}
                    actionRunning={actionRunning}
                    onAcceptAllSuggestions={acceptAllUnitSuggestions}
                    onAcceptSuggestion={acceptUnitSuggestion}
                    onNormalizeUnits={normalizeUnits}
                  />
                </TabsContent>

                <TabsContent value="products" className="mt-4 flex min-h-0 min-w-0 flex-1">
                  <ProductsTab
                    data={data}
                    productMaps={productMaps}
                    setProductMaps={setProductMaps}
                    createProductChecked={createProductChecked}
                    setCreateProductChecked={setCreateProductChecked}
                    productSearch={productSearch}
                    setProductSearch={setProductSearch}
                    grocyProductOptions={grocyProductOptions}
                    grocyUnitOptions={grocyUnitOptions}
                    mappedUnitOptions={mappedUnitOptions}
                    defaultCreateUnitId={defaultCreateUnitId}
                    setDefaultCreateUnitId={setDefaultCreateUnitId}
                    actionRunning={actionRunning}
                    onAcceptAllSuggestions={acceptAllProductSuggestions}
                    onAcceptSuggestion={acceptProductSuggestion}
                    onNormalizeProducts={normalizeProducts}
                  />
                </TabsContent>

                <TabsContent value="grocy-min-stock" className="mt-4 flex min-h-0 min-w-0 flex-1">
                  <GrocyMinStockProductsTab
                    data={data}
                    productMaps={grocyMinStockProductMaps}
                    setProductMaps={setGrocyMinStockProductMaps}
                    createProductChecked={createMealieProductChecked}
                    setCreateProductChecked={setCreateMealieProductChecked}
                    productSearch={grocyMinStockProductSearch}
                    setProductSearch={setGrocyMinStockProductSearch}
                    mealieProductOptions={mealieProductOptions}
                    grocyUnitOptions={grocyUnitOptions}
                    actionRunning={actionRunning}
                    onAcceptAllSuggestions={acceptAllGrocyMinStockProductSuggestions}
                    onAcceptSuggestion={acceptGrocyMinStockProductSuggestion}
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>

          {data && <WizardFooter
            tab={tab}
            actionRunning={actionRunning}
            unitMappedCount={Object.values(unitMaps).filter(m => m.grocyUnitId !== null).length}
            checkedUnitCount={unmappedUnitIds.filter(id => createUnitChecked[id]).length}
            orphanUnitCount={data.orphanGrocyUnitCount}
            productMappedCount={Object.values(productMaps).filter(m => m.grocyProductId !== null).length}
            checkedProductCount={unmappedProductIds.filter(id => createProductChecked[id]).length}
            orphanProductCount={data.orphanGrocyProductCount}
            grocyMinStockProductMappedCount={Object.values(grocyMinStockProductMaps).filter(m => m.mealieFoodId !== null).length}
            checkedGrocyMinStockProductCount={unmappedGrocyMinStockProductIds.filter(id => createMealieProductChecked[id]).length}
            defaultCreateUnitId={defaultCreateUnitId}
            onSyncUnits={syncUnits}
            onCreateUnits={createUnmappedUnits}
            onDeleteOrphanUnits={handleDeleteOrphanUnits}
            onSyncProducts={syncProducts}
            onCreateProducts={createUnmappedProducts}
            onDeleteOrphanProducts={handleDeleteOrphanProducts}
            onSyncGrocyMinStockProducts={syncGrocyMinStockProducts}
            onCreateMealieProducts={createMealieProductsFromGrocy}
          />}

          <ConfirmDialog
            open={confirmAction !== null}
            onClose={closeConfirm}
            onConfirm={() => confirmCallback?.()}
            title={confirmTitle}
            description={confirmDescription}
            itemNames={confirmItemNames}
            running={isRunning}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// --- Footer (fixed at bottom of dialog) ---

interface WizardFooterProps {
  tab: 'units' | 'products' | 'grocy-min-stock';
  actionRunning: string | null;
  unitMappedCount: number;
  checkedUnitCount: number;
  orphanUnitCount: number;
  productMappedCount: number;
  checkedProductCount: number;
  orphanProductCount: number;
  grocyMinStockProductMappedCount: number;
  checkedGrocyMinStockProductCount: number;
  defaultCreateUnitId: number | null;
  onSyncUnits: () => void;
  onCreateUnits: () => void;
  onDeleteOrphanUnits: () => void;
  onSyncProducts: () => void;
  onCreateProducts: () => void;
  onDeleteOrphanProducts: () => void;
  onSyncGrocyMinStockProducts: () => void;
  onCreateMealieProducts: () => void;
}

function WizardFooter({
  tab,
  actionRunning,
  unitMappedCount,
  checkedUnitCount,
  orphanUnitCount,
  productMappedCount,
  checkedProductCount,
  orphanProductCount,
  grocyMinStockProductMappedCount,
  checkedGrocyMinStockProductCount,
  defaultCreateUnitId,
  onSyncUnits,
  onCreateUnits,
  onDeleteOrphanUnits,
  onSyncProducts,
  onCreateProducts,
  onDeleteOrphanProducts,
  onSyncGrocyMinStockProducts,
  onCreateMealieProducts,
}: WizardFooterProps) {
  const isRunning = !!actionRunning;

  if (tab === 'units') {
    return (
      <DialogFooter className="flex-row flex-wrap gap-2 sm:justify-start">
        <Button size="sm" onClick={onSyncUnits} disabled={isRunning || unitMappedCount === 0}>
          {actionRunning === 'syncUnits' ? <Loader2 className="size-4 animate-spin" /> : <Link className="size-4" />}
          {actionRunning === 'syncUnits' ? 'Syncing...' : `Sync Mapped (${unitMappedCount})`}
        </Button>
        <Button variant="secondary" size="sm" onClick={onCreateUnits} disabled={isRunning || checkedUnitCount === 0}>
          {actionRunning === 'createUnits' ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {actionRunning === 'createUnits' ? 'Creating...' : `Create Checked in Grocy (${checkedUnitCount})`}
        </Button>
        <Button variant="destructive" size="sm" onClick={onDeleteOrphanUnits} disabled={isRunning || orphanUnitCount === 0}>
          <Trash2 className="size-4" />
          Delete Grocy Orphans ({orphanUnitCount})
        </Button>
      </DialogFooter>
    );
  }

  if (tab === 'grocy-min-stock') {
    return (
      <DialogFooter className="flex-row flex-wrap gap-2 sm:justify-start">
        <Button size="sm" onClick={onSyncGrocyMinStockProducts} disabled={isRunning || grocyMinStockProductMappedCount === 0}>
          {actionRunning === 'syncGrocyMinStockProducts' ? <Loader2 className="size-4 animate-spin" /> : <Link className="size-4" />}
          {actionRunning === 'syncGrocyMinStockProducts' ? 'Syncing...' : `Sync Mapped (${grocyMinStockProductMappedCount})`}
        </Button>
        <Button variant="secondary" size="sm" onClick={onCreateMealieProducts} disabled={isRunning || checkedGrocyMinStockProductCount === 0}>
          {actionRunning === 'createMealieProducts' ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {actionRunning === 'createMealieProducts' ? 'Creating...' : `Create Checked in Mealie (${checkedGrocyMinStockProductCount})`}
        </Button>
      </DialogFooter>
    );
  }

  return (
    <DialogFooter className="flex-row flex-wrap gap-2 sm:justify-start">
      <Button size="sm" onClick={onSyncProducts} disabled={isRunning || productMappedCount === 0}>
        {actionRunning === 'syncProducts' ? <Loader2 className="size-4 animate-spin" /> : <Link className="size-4" />}
        {actionRunning === 'syncProducts' ? 'Syncing...' : `Sync Mapped (${productMappedCount})`}
      </Button>
      <Button variant="secondary" size="sm" onClick={onCreateProducts} disabled={isRunning || !defaultCreateUnitId || checkedProductCount === 0}>
        {actionRunning === 'createProducts' ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        {actionRunning === 'createProducts' ? 'Creating...' : `Create Checked in Grocy (${checkedProductCount})`}
      </Button>
      <Button variant="destructive" size="sm" onClick={onDeleteOrphanProducts} disabled={isRunning || orphanProductCount === 0}>
        <Trash2 className="size-4" />
        Delete Grocy Orphans ({orphanProductCount})
      </Button>
    </DialogFooter>
  );
}

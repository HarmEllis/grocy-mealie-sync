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
import { MappedProductsTab } from './MappedProductsTab';
import { UnitsTab } from './UnitsTab';
import { ProductsTab } from './ProductsTab';
import type {
  GrocyMinStockProductMapping,
  GrocyMinStockTabData,
  MappedProductsTabData,
  ProductMapping,
  ProductsTabData,
  UnitMapping,
  UnitsTabData,
} from './types';
import { sortByName } from './types';
import {
  buildGrocyMinStockProductMaps,
  buildProductMaps,
  buildUnitMaps,
  mergeCheckedState,
  mergeGrocyMinStockProductMaps,
  mergeProductMaps,
  mergeUnitMaps,
  type WizardTab,
} from './state';

interface FetchTabDataOptions {
  preserveWizardState?: boolean;
  showLoading?: boolean;
}

const TAB_ENDPOINTS: Record<WizardTab, string> = {
  units: '/api/mapping-wizard/data?tab=units',
  products: '/api/mapping-wizard/data?tab=products',
  'grocy-min-stock': '/api/mapping-wizard/data?tab=grocy-min-stock',
  'mapped-products': '/api/mapping-wizard/products/mapped',
};

const INITIAL_TAB_LOADING: Record<WizardTab, boolean> = {
  units: false,
  products: false,
  'grocy-min-stock': false,
  'mapped-products': false,
};

const INITIAL_TAB_ERRORS: Record<WizardTab, string | null> = {
  units: null,
  products: null,
  'grocy-min-stock': null,
  'mapped-products': null,
};

const INITIAL_DIRTY_TABS: Record<WizardTab, boolean> = {
  units: false,
  products: false,
  'grocy-min-stock': false,
  'mapped-products': false,
};

export function MappingWizard() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<WizardTab>('units');
  const [unitsData, setUnitsData] = useState<UnitsTabData | null>(null);
  const [productsData, setProductsData] = useState<ProductsTabData | null>(null);
  const [grocyMinStockData, setGrocyMinStockData] = useState<GrocyMinStockTabData | null>(null);
  const [mappedProductsData, setMappedProductsData] = useState<MappedProductsTabData | null>(null);
  const [tabLoading, setTabLoading] = useState(INITIAL_TAB_LOADING);
  const [tabErrors, setTabErrors] = useState(INITIAL_TAB_ERRORS);
  const [dirtyTabs, setDirtyTabs] = useState(INITIAL_DIRTY_TABS);
  const [actionRunning, setActionRunning] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [grocyMinStockProductSearch, setGrocyMinStockProductSearch] = useState('');
  const [mappedProductSearch, setMappedProductSearch] = useState('');
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

  const fetchTabData = useCallback(async (
    targetTab: WizardTab,
    {
      preserveWizardState = false,
      showLoading = true,
  }: FetchTabDataOptions = {},
  ): Promise<UnitsTabData | ProductsTabData | GrocyMinStockTabData | MappedProductsTabData | null> => {
    if (showLoading) {
      setTabLoading(prev => ({ ...prev, [targetTab]: true }));
    }
    setTabErrors(prev => ({ ...prev, [targetTab]: null }));

    try {
      const res = await fetch(TAB_ENDPOINTS[targetTab]);
      if (!res.ok) {
        throw new Error('Failed to fetch');
      }

      let parsedData: UnitsTabData | ProductsTabData | GrocyMinStockTabData | MappedProductsTabData | null = null;

      switch (targetTab) {
        case 'units': {
          const data: UnitsTabData = await res.json();
          parsedData = data;
          setUnitsData(data);

          if (preserveWizardState) {
            setUnitMaps(prev => mergeUnitMaps(data, prev));
            setCreateUnitChecked(prev => mergeCheckedState(data.unmappedMealieUnits.map(unit => unit.id), prev));
          } else {
            setUnitMaps(buildUnitMaps(data));
            setCreateUnitChecked({});
          }
          break;
        }
        case 'products': {
          const data: ProductsTabData = await res.json();
          parsedData = data;
          setProductsData(data);

          if (preserveWizardState) {
            setProductMaps(prev => mergeProductMaps(data, prev));
            setCreateProductChecked(prev => mergeCheckedState(data.unmappedMealieFoods.map(food => food.id), prev));
          } else {
            setProductMaps(buildProductMaps(data));
            setCreateProductChecked({});
          }

          setDefaultCreateUnitId(prev => prev ?? (data.existingUnitMappings[0]?.grocyUnitId ?? data.grocyUnits[0]?.id ?? null));
          break;
        }
        case 'grocy-min-stock': {
          const data: GrocyMinStockTabData = await res.json();
          parsedData = data;
          setGrocyMinStockData(data);

          if (preserveWizardState) {
            setGrocyMinStockProductMaps(prev => mergeGrocyMinStockProductMaps(data, prev));
            setCreateMealieProductChecked(prev => mergeCheckedState(
              data.unmappedGrocyMinStockProducts.map(product => product.id),
              prev,
            ));
          } else {
            setGrocyMinStockProductMaps(buildGrocyMinStockProductMaps(data));
            setCreateMealieProductChecked({});
          }
          break;
        }
        case 'mapped-products': {
          const data: MappedProductsTabData = await res.json();
          parsedData = data;
          setMappedProductsData(data);
          break;
        }
      }

      setDirtyTabs(prev => ({ ...prev, [targetTab]: false }));
      return parsedData;
    } catch {
      setTabErrors(prev => ({ ...prev, [targetTab]: 'Failed to load data. Check API connections.' }));
      toast.error('Failed to load mapping data');
      return null;
    } finally {
      if (showLoading) {
        setTabLoading(prev => ({ ...prev, [targetTab]: false }));
      }
    }
  }, []);

  const ensureTabDataLoaded = useCallback(async (targetTab: WizardTab) => {
    const hasData = targetTab === 'units'
      ? unitsData !== null
      : targetTab === 'products'
        ? productsData !== null
        : targetTab === 'grocy-min-stock'
          ? grocyMinStockData !== null
          : mappedProductsData !== null;

    if (hasData && !dirtyTabs[targetTab]) {
      return;
    }

    await fetchTabData(targetTab, {
      preserveWizardState: hasData,
      showLoading: true,
    });
  }, [dirtyTabs, fetchTabData, grocyMinStockData, mappedProductsData, productsData, unitsData]);

  useEffect(() => {
    if (!open) {
      return;
    }

    void ensureTabDataLoaded(tab);
  }, [open, tab, ensureTabDataLoaded]);

  function markOtherLoadedTabsDirty(activeTab: WizardTab) {
    setDirtyTabs(prev => ({
      units: activeTab === 'units' ? false : prev.units || unitsData !== null,
      products: activeTab === 'products' ? false : prev.products || productsData !== null,
      'grocy-min-stock': activeTab === 'grocy-min-stock'
        ? false
        : prev['grocy-min-stock'] || grocyMinStockData !== null,
      'mapped-products': activeTab === 'mapped-products'
        ? false
        : prev['mapped-products'] || mappedProductsData !== null,
    }));
  }

  // Sorted options for SearchableSelect
  const unitGrocyUnitOptions = useMemo(() =>
    unitsData ? sortByName(unitsData.grocyUnits).map(unit => ({ value: unit.id, label: unit.name })) : [],
    [unitsData],
  );
  const productGrocyProductOptions = useMemo(() =>
    productsData ? sortByName(productsData.grocyProducts).map(product => ({ value: product.id, label: product.name })) : [],
    [productsData],
  );
  const productGrocyUnitOptions = useMemo(() =>
    productsData ? sortByName(productsData.grocyUnits).map(unit => ({ value: unit.id, label: unit.name })) : [],
    [productsData],
  );
  const grocyMinStockGrocyUnitOptions = useMemo(() =>
    grocyMinStockData ? sortByName(grocyMinStockData.grocyUnits).map(unit => ({ value: unit.id, label: unit.name })) : [],
    [grocyMinStockData],
  );
  const mealieProductOptions = useMemo(() =>
    grocyMinStockData
      ? sortByName(grocyMinStockData.unmappedMealieFoods).map(food => ({ value: food.id, label: food.name }))
      : [],
    [grocyMinStockData],
  );
  const mappedUnitOptions = useMemo(() =>
    productsData
      ? sortByName(productsData.existingUnitMappings.map(mapping => ({
        name: mapping.mealieUnitName,
        id: mapping.grocyUnitId,
      }))).map(unit => ({ value: unit.id, label: unit.name }))
      : [],
    [productsData],
  );

  // Unmapped IDs for "create" checkboxes
  const unmappedProductIds = useMemo(() =>
    Object.entries(productMaps).filter(([, mapping]) => mapping.grocyProductId === null).map(([id]) => id),
    [productMaps],
  );
  const unmappedGrocyMinStockProductIds = useMemo(() =>
    Object.entries(grocyMinStockProductMaps)
      .filter(([, mapping]) => mapping.mealieFoodId === null)
      .map(([id]) => id),
    [grocyMinStockProductMaps],
  );
  const unmappedUnitIds = useMemo(() =>
    Object.entries(unitMaps).filter(([, mapping]) => mapping.grocyUnitId === null).map(([id]) => id),
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
    } catch (error) {
      toast.error(String(error));
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
    if (!productsData) {
      return;
    }

    setProductMaps(prev => {
      const next = { ...prev };
      for (const food of productsData.unmappedMealieFoods) {
        const suggestion = productsData.productSuggestions[food.id];
        if (suggestion) {
          next[food.id] = {
            mealieFoodId: food.id,
            grocyProductId: suggestion.grocyProductId,
            grocyUnitId: suggestion.suggestedUnitId,
          };
        }
      }
      return next;
    });
  }

  function acceptProductSuggestion(id: string) {
    const suggestion = productsData?.productSuggestions[id];
    if (!suggestion) {
      return;
    }

    setProductMaps(prev => ({
      ...prev,
      [id]: {
        mealieFoodId: id,
        grocyProductId: suggestion.grocyProductId,
        grocyUnitId: suggestion.suggestedUnitId,
      },
    }));
  }

  function acceptAllGrocyMinStockProductSuggestions() {
    if (!grocyMinStockData) {
      return;
    }

    setGrocyMinStockProductMaps(prev => {
      const next = { ...prev };
      for (const product of grocyMinStockData.unmappedGrocyMinStockProducts) {
        const suggestion = grocyMinStockData.lowStockGrocyProductSuggestions[String(product.id)];
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
    if (!grocyMinStockData) {
      return;
    }

    const suggestion = grocyMinStockData.lowStockGrocyProductSuggestions[String(grocyProductId)];
    const grocyProduct = grocyMinStockData.unmappedGrocyMinStockProducts.find(product => product.id === grocyProductId);
    if (!suggestion || !grocyProduct) {
      return;
    }

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
    if (!unitsData) {
      return;
    }

    setUnitMaps(prev => {
      const next = { ...prev };
      for (const unit of unitsData.unmappedMealieUnits) {
        const suggestion = unitsData.unitSuggestions[unit.id];
        if (suggestion) {
          next[unit.id] = { mealieUnitId: unit.id, grocyUnitId: suggestion.grocyUnitId };
        }
      }
      return next;
    });
  }

  function acceptUnitSuggestion(id: string) {
    const suggestion = unitsData?.unitSuggestions[id];
    if (!suggestion) {
      return;
    }

    setUnitMaps(prev => ({ ...prev, [id]: { mealieUnitId: id, grocyUnitId: suggestion.grocyUnitId } }));
  }

  // --- Product Actions ---

  async function normalizeProducts() {
    await runAction('normalizeProducts', async () => {
      const res = await fetch('/api/mapping-wizard/products/normalize', { method: 'POST' });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to normalize products');
      }

      const refreshedData = await fetchTabData('products', { preserveWizardState: true, showLoading: false });
      markOtherLoadedTabsDirty('products');

      const skipped = result.skippedDuplicates?.length ?? 0;
      toast.success(`Normalized ${result.normalizedMealie} Mealie products and ${result.normalizedGrocy} Grocy products${skipped ? `, ${skipped} skipped` : ''}`);
      if (skipped) {
        toast.warning(
          `${skipped} products skipped: a product with the target name already exists in Mealie (duplicates with different casing or trailing spaces). Remove the duplicate in Mealie first.`,
          { duration: 15000 },
        );
      }

      if (!refreshedData) {
        throw new Error('Failed to refresh products tab');
      }
    });
  }

  async function syncProducts() {
    const filled = Object.values(productMaps).filter(mapping => mapping.grocyProductId !== null);
    if (filled.length === 0) {
      toast.info('No products mapped');
      return;
    }

    await runAction('syncProducts', async () => {
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
      if (!res.ok) {
        throw new Error(result.error);
      }

      const refreshedData = await fetchTabData('products', { preserveWizardState: true, showLoading: false });
      markOtherLoadedTabsDirty('products');

      if (refreshedData && 'unmappedMealieFoods' in refreshedData && refreshedData.unmappedMealieFoods.length === 0) {
        toast.success(`Synced ${result.synced} products, renamed ${result.renamed}`);
        promptAutoCreate('autoCreateProducts', 'All products are now mapped. Enable auto-create for future products?');
        return;
      }

      toast.success(`Synced ${result.synced} products, renamed ${result.renamed}`);
    });
  }

  async function createUnmappedProducts() {
    if (!productsData) {
      return;
    }

    const checkedIds = unmappedProductIds.filter(id => createProductChecked[id]);
    if (checkedIds.length === 0) {
      toast.info('No products checked for creation');
      return;
    }
    if (!defaultCreateUnitId) {
      toast.info('Select a default unit first');
      return;
    }

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
      if (!res.ok) {
        throw new Error(result.error);
      }

      const refreshedData = await fetchTabData('products', { preserveWizardState: true, showLoading: false });
      markOtherLoadedTabsDirty('products');

      if (refreshedData && 'unmappedMealieFoods' in refreshedData && refreshedData.unmappedMealieFoods.length === 0) {
        toast.success(`Created ${result.created} products`);
        promptAutoCreate('autoCreateProducts', 'All products are now mapped. Enable auto-create for future products?');
        return;
      }

      toast.success(`Created ${result.created} products${result.skipped ? `, ${result.skipped} skipped` : ''}`);
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
      if (!res.ok) {
        throw new Error(result.error || 'Failed to sync products');
      }

      await fetchTabData('grocy-min-stock', { preserveWizardState: true, showLoading: false });
      markOtherLoadedTabsDirty('grocy-min-stock');
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
      if (!res.ok) {
        throw new Error(result.error || 'Failed to create Mealie products');
      }

      await fetchTabData('grocy-min-stock', { preserveWizardState: true, showLoading: false });
      markOtherLoadedTabsDirty('grocy-min-stock');
      toast.success(`Created ${result.created} Mealie products${result.skipped ? `, ${result.skipped} skipped` : ''}`);
    });
  }

  async function deleteOrphanProducts(orphanNames: string[], orphanIds: string[]) {
    await runAction('deleteOrphanProducts', async () => {
      if (orphanIds.length === 0) {
        toast.info('No orphan products to delete');
        return;
      }

      const res = await fetch('/api/mapping-wizard/products/orphans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, ids: orphanIds }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error);
      }

      await fetchTabData('products', { preserveWizardState: true, showLoading: false });
      markOtherLoadedTabsDirty('products');
      toast.success(`Deleted ${result.deleted} orphan products`);
    });
  }

  async function handleDeleteOrphanProducts() {
    try {
      const listRes = await fetch('/api/mapping-wizard/products/orphans');
      const listData = await listRes.json();
      if (!listRes.ok) {
        throw new Error(listData.error);
      }
      if (listData.orphans.length === 0) {
        toast.info('No orphan products to delete');
        return;
      }

      const names = listData.orphans.map((orphan: { id: string; name: string }) => orphan.name || orphan.id);
      const ids = listData.orphans.map((orphan: { id: string }) => orphan.id);
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
      if (!res.ok) {
        throw new Error(result.error || 'Failed to normalize units');
      }

      const refreshedData = await fetchTabData('units', { preserveWizardState: true, showLoading: false });
      markOtherLoadedTabsDirty('units');

      const skipped = result.skippedDuplicates?.length ?? 0;
      toast.success(`Normalized ${result.normalizedMealie} Mealie units and ${result.normalizedGrocy} Grocy units${skipped ? `, ${skipped} skipped` : ''}`);
      if (skipped) {
        toast.warning(
          `${skipped} units skipped: a unit with the target name already exists in Mealie (duplicates with different casing or trailing spaces). Remove the duplicate in Mealie first.`,
          { duration: 15000 },
        );
      }

      if (!refreshedData) {
        throw new Error('Failed to refresh units tab');
      }
    });
  }

  async function syncUnits() {
    const filled = Object.values(unitMaps).filter(mapping => mapping.grocyUnitId !== null);
    if (filled.length === 0) {
      toast.info('No units mapped');
      return;
    }

    await runAction('syncUnits', async () => {
      const res = await fetch('/api/mapping-wizard/units/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mappings: filled.map(mapping => ({
            mealieUnitId: mapping.mealieUnitId,
            grocyUnitId: mapping.grocyUnitId,
          })),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error);
      }

      const refreshedData = await fetchTabData('units', { preserveWizardState: true, showLoading: false });
      markOtherLoadedTabsDirty('units');

      if (refreshedData && 'unmappedMealieUnits' in refreshedData && refreshedData.unmappedMealieUnits.length === 0) {
        toast.success(`Synced ${result.synced} units, renamed ${result.renamed}`);
        promptAutoCreate('autoCreateUnits', 'All units are now mapped. Enable auto-create for future units?');
        return;
      }

      toast.success(`Synced ${result.synced} units, renamed ${result.renamed}`);
    });
  }

  async function createUnmappedUnits() {
    if (!unitsData) {
      return;
    }

    const checkedIds = unmappedUnitIds.filter(id => createUnitChecked[id]);
    if (checkedIds.length === 0) {
      toast.info('No units checked for creation');
      return;
    }

    await runAction('createUnits', async () => {
      const res = await fetch('/api/mapping-wizard/units/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealieUnitIds: checkedIds }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error);
      }

      const refreshedData = await fetchTabData('units', { preserveWizardState: true, showLoading: false });
      markOtherLoadedTabsDirty('units');

      if (refreshedData && 'unmappedMealieUnits' in refreshedData && refreshedData.unmappedMealieUnits.length === 0) {
        toast.success(`Created ${result.created} units`);
        promptAutoCreate('autoCreateUnits', 'All units are now mapped. Enable auto-create for future units?');
        return;
      }

      toast.success(`Created ${result.created} units${result.skipped ? `, ${result.skipped} skipped` : ''}`);
    });
  }

  async function deleteOrphanUnits(orphanNames: string[], orphanIds: string[]) {
    await runAction('deleteOrphanUnits', async () => {
      if (orphanIds.length === 0) {
        toast.info('No orphan units to delete');
        return;
      }

      const res = await fetch('/api/mapping-wizard/units/orphans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, ids: orphanIds }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error);
      }

      await fetchTabData('units', { preserveWizardState: true, showLoading: false });
      markOtherLoadedTabsDirty('units');
      toast.success(`Deleted ${result.deleted} orphan units`);
    });
  }

  async function handleDeleteOrphanUnits() {
    try {
      const listRes = await fetch('/api/mapping-wizard/units/orphans');
      const listData = await listRes.json();
      if (!listRes.ok) {
        throw new Error(listData.error);
      }
      if (listData.orphans.length === 0) {
        toast.info('No orphan units to delete');
        return;
      }

      const names = listData.orphans.map((orphan: { id: string; name: string }) => orphan.name || orphan.id);
      const ids = listData.orphans.map((orphan: { id: string }) => orphan.id);
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

  const currentTabLoading = tabLoading[tab];
  const currentTabError = tabErrors[tab];
  const currentTabData = tab === 'units'
    ? unitsData
    : tab === 'products'
      ? productsData
      : tab === 'grocy-min-stock'
        ? grocyMinStockData
        : mappedProductsData;
  const isRunning = !!actionRunning;

  async function updateMappedProductMinStock(grocyProductId: number, minStockAmount: number) {
    const res = await fetch('/api/mapping-wizard/products/mapped', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grocyProductId, minStockAmount }),
    });
    const result = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(result?.error || 'Failed to update minimum stock');
    }

    setMappedProductsData(prev => prev ? ({
      allowDecimalMinStock: prev.allowDecimalMinStock,
      mappedProducts: prev.mappedProducts.map(product =>
        product.grocyProductId === grocyProductId
          ? { ...product, minStockAmount }
          : product,
      ),
    }) : prev);
    markOtherLoadedTabsDirty('mapped-products');
    toast.success('Minimum stock updated');
  }

  function renderCurrentTab() {
    if (currentTabLoading && !currentTabData) {
      return (
        <div className="space-y-3 py-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-8 w-64" />
        </div>
      );
    }

    if (!currentTabData) {
      return (
        <p className="py-4 text-sm text-destructive">
          {currentTabError || 'Failed to load data. Check API connections.'}
        </p>
      );
    }

    switch (tab) {
      case 'units':
        return (
          <UnitsTab
            data={unitsData!}
            unitMaps={unitMaps}
            setUnitMaps={setUnitMaps}
            createUnitChecked={createUnitChecked}
            setCreateUnitChecked={setCreateUnitChecked}
            unitSearch={unitSearch}
            setUnitSearch={setUnitSearch}
            grocyUnitOptions={unitGrocyUnitOptions}
            actionRunning={actionRunning}
            onAcceptAllSuggestions={acceptAllUnitSuggestions}
            onAcceptSuggestion={acceptUnitSuggestion}
            onNormalizeUnits={normalizeUnits}
          />
        );
      case 'products':
        return (
          <ProductsTab
            data={productsData!}
            productMaps={productMaps}
            setProductMaps={setProductMaps}
            createProductChecked={createProductChecked}
            setCreateProductChecked={setCreateProductChecked}
            productSearch={productSearch}
            setProductSearch={setProductSearch}
            grocyProductOptions={productGrocyProductOptions}
            grocyUnitOptions={productGrocyUnitOptions}
            mappedUnitOptions={mappedUnitOptions}
            defaultCreateUnitId={defaultCreateUnitId}
            setDefaultCreateUnitId={setDefaultCreateUnitId}
            actionRunning={actionRunning}
            onAcceptAllSuggestions={acceptAllProductSuggestions}
            onAcceptSuggestion={acceptProductSuggestion}
            onNormalizeProducts={normalizeProducts}
          />
        );
      case 'grocy-min-stock':
        return (
          <GrocyMinStockProductsTab
            data={grocyMinStockData!}
            productMaps={grocyMinStockProductMaps}
            setProductMaps={setGrocyMinStockProductMaps}
            createProductChecked={createMealieProductChecked}
            setCreateProductChecked={setCreateMealieProductChecked}
            productSearch={grocyMinStockProductSearch}
            setProductSearch={setGrocyMinStockProductSearch}
            mealieProductOptions={mealieProductOptions}
            grocyUnitOptions={grocyMinStockGrocyUnitOptions}
            actionRunning={actionRunning}
            onAcceptAllSuggestions={acceptAllGrocyMinStockProductSuggestions}
            onAcceptSuggestion={acceptGrocyMinStockProductSuggestion}
          />
        );
      case 'mapped-products':
        return (
          <MappedProductsTab
            data={mappedProductsData!}
            productSearch={mappedProductSearch}
            setProductSearch={setMappedProductSearch}
            onUpdateMinStock={updateMappedProductMinStock}
            allowDecimalMinStock={mappedProductsData!.allowDecimalMinStock}
          />
        );
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className={open ? 'opacity-70' : ''}>
        <Wand2 className="size-4" />
        {open ? 'Mapping Wizard (Open)' : 'Mapping Wizard'}
      </Button>

      <Dialog open={open} onOpenChange={value => { if (!value && !isRunning) setOpen(false); }}>
        <DialogContent className="flex h-[85vh] max-h-[85vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Mapping Wizard</DialogTitle>
            <DialogDescription>
              Map Mealie items to existing Grocy items, or create new ones. Start with units, then products.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Tabs className="flex min-h-0 min-w-0 flex-1" value={tab} onValueChange={value => setTab(value as WizardTab)}>
              <div className="-mx-1 overflow-x-auto pb-1">
                <TabsList variant="line" className="min-w-max px-1">
                  <TabsTrigger value="units">
                    Units{unitsData ? ` (${unitsData.unmappedMealieUnits.length} unmapped)` : ''}
                  </TabsTrigger>
                  <TabsTrigger value="products">
                    Products{productsData ? ` (${productsData.unmappedMealieFoods.length} unmapped)` : ''}
                  </TabsTrigger>
                  <TabsTrigger value="grocy-min-stock">
                    Grocy Min Stock{grocyMinStockData ? ` (${grocyMinStockData.unmappedGrocyMinStockProducts.length} unmapped)` : ''}
                  </TabsTrigger>
                  <TabsTrigger value="mapped-products">
                    Mapped Products{mappedProductsData ? ` (${mappedProductsData.mappedProducts.length})` : ''}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value={tab} className="mt-4 flex min-h-0 min-w-0 flex-1">
                {renderCurrentTab()}
              </TabsContent>
            </Tabs>
          </div>

          {currentTabData && tab !== 'mapped-products' && (
            <WizardFooter
              tab={tab}
              actionRunning={actionRunning}
              unitMappedCount={Object.values(unitMaps).filter(mapping => mapping.grocyUnitId !== null).length}
              checkedUnitCount={unmappedUnitIds.filter(id => createUnitChecked[id]).length}
              orphanUnitCount={unitsData?.orphanGrocyUnitCount ?? 0}
              productMappedCount={Object.values(productMaps).filter(mapping => mapping.grocyProductId !== null).length}
              checkedProductCount={unmappedProductIds.filter(id => createProductChecked[id]).length}
              orphanProductCount={productsData?.orphanGrocyProductCount ?? 0}
              grocyMinStockProductMappedCount={Object.values(grocyMinStockProductMaps).filter(mapping => mapping.mealieFoodId !== null).length}
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
            />
          )}

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

interface WizardFooterProps {
  tab: WizardTab;
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

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { ConflictsTab } from './ConflictsTab';
import { GrocyMinStockProductsTab } from './GrocyMinStockProductsTab';
import { MappedProductsTab } from './MappedProductsTab';
import { UnitsTab } from './UnitsTab';
import { ProductsTab } from './ProductsTab';
import type {
  ConflictRemapData,
  ConflictsTabData,
  GrocyMinStockProductMapping,
  GrocyMinStockTabData,
  MappingConflictRow,
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
  getPendingUnitMappings,
  mergeCheckedState,
  mergeGrocyMinStockProductMaps,
  mergeProductMaps,
  mergeUnitMaps,
  type WizardTab,
} from './state';
import { OPEN_MAPPING_WIZARD_EVENT } from './events';
import { applyBulkSuggestions, isSuggestionTargetAvailable } from './suggestion-actions';

interface FetchTabDataOptions {
  preserveWizardState?: boolean;
  showLoading?: boolean;
}

const TAB_ENDPOINTS: Record<WizardTab, string> = {
  units: '/api/mapping-wizard/data?tab=units',
  products: '/api/mapping-wizard/data?tab=products',
  'grocy-min-stock': '/api/mapping-wizard/data?tab=grocy-min-stock',
  'mapped-products': '/api/mapping-wizard/products/mapped',
  conflicts: '/api/mapping-wizard/conflicts',
};

const INITIAL_TAB_LOADING: Record<WizardTab, boolean> = {
  units: false,
  products: false,
  'grocy-min-stock': false,
  'mapped-products': false,
  conflicts: false,
};

const INITIAL_TAB_ERRORS: Record<WizardTab, string | null> = {
  units: null,
  products: null,
  'grocy-min-stock': null,
  'mapped-products': null,
  conflicts: null,
};

const INITIAL_DIRTY_TABS: Record<WizardTab, boolean> = {
  units: false,
  products: false,
  'grocy-min-stock': false,
  'mapped-products': false,
  conflicts: false,
};

export function MappingWizard() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<WizardTab>('units');
  const [unitsData, setUnitsData] = useState<UnitsTabData | null>(null);
  const [productsData, setProductsData] = useState<ProductsTabData | null>(null);
  const [grocyMinStockData, setGrocyMinStockData] = useState<GrocyMinStockTabData | null>(null);
  const [mappedProductsData, setMappedProductsData] = useState<MappedProductsTabData | null>(null);
  const [conflictsData, setConflictsData] = useState<ConflictsTabData | null>(null);
  const [tabLoading, setTabLoading] = useState(INITIAL_TAB_LOADING);
  const [tabErrors, setTabErrors] = useState(INITIAL_TAB_ERRORS);
  const [dirtyTabs, setDirtyTabs] = useState(INITIAL_DIRTY_TABS);
  const [actionRunning, setActionRunning] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [grocyMinStockProductSearch, setGrocyMinStockProductSearch] = useState('');
  const [mappedProductSearch, setMappedProductSearch] = useState('');
  const [unitSearch, setUnitSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState<'unmapped' | 'mapped' | 'all'>('unmapped');
  const [showOnlyGrocyMinStockBelowMinimum, setShowOnlyGrocyMinStockBelowMinimum] = useState(false);
  const [showOnlyMappedProductsBelowMinimum, setShowOnlyMappedProductsBelowMinimum] = useState(false);
  const [bulkSuggestionTab, setBulkSuggestionTab] = useState<'units' | 'products' | 'grocy-min-stock' | null>(null);
  const [bulkSuggestionThreshold, setBulkSuggestionThreshold] = useState('90');
  const [remapConflict, setRemapConflict] = useState<MappingConflictRow | null>(null);
  const [remapData, setRemapData] = useState<ConflictRemapData | null>(null);
  const [remapProductDraft, setRemapProductDraft] = useState<{
    mealieFoodId: string | null;
    grocyProductId: number | null;
    grocyUnitId: number | null;
  }>({
    mealieFoodId: null,
    grocyProductId: null,
    grocyUnitId: null,
  });
  const [remapUnitDraft, setRemapUnitDraft] = useState<{
    mealieUnitId: string | null;
    grocyUnitId: number | null;
  }>({
    mealieUnitId: null,
    grocyUnitId: null,
  });

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

  useEffect(() => {
    const handleOpenMappingWizard = (event: Event) => {
      const customEvent = event as CustomEvent<{ tab?: WizardTab }>;
      const targetTab = customEvent.detail?.tab ?? 'units';

      setTab(targetTab);
      setOpen(true);
    };

    window.addEventListener(OPEN_MAPPING_WIZARD_EVENT, handleOpenMappingWizard);
    return () => {
      window.removeEventListener(OPEN_MAPPING_WIZARD_EVENT, handleOpenMappingWizard);
    };
  }, []);

  const fetchTabData = useCallback(async (
    targetTab: WizardTab,
    {
      preserveWizardState = false,
      showLoading = true,
  }: FetchTabDataOptions = {},
  ): Promise<UnitsTabData | ProductsTabData | GrocyMinStockTabData | MappedProductsTabData | ConflictsTabData | null> => {
    if (showLoading) {
      setTabLoading(prev => ({ ...prev, [targetTab]: true }));
    }
    setTabErrors(prev => ({ ...prev, [targetTab]: null }));

    try {
      const res = await fetch(TAB_ENDPOINTS[targetTab]);
      if (!res.ok) {
        throw new Error('Failed to fetch');
      }

      let parsedData: UnitsTabData | ProductsTabData | GrocyMinStockTabData | MappedProductsTabData | ConflictsTabData | null = null;

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
        case 'conflicts': {
          const data: ConflictsTabData = await res.json();
          parsedData = data;
          setConflictsData(data);
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
          : targetTab === 'mapped-products'
            ? mappedProductsData !== null
            : conflictsData !== null;

    if (hasData && !dirtyTabs[targetTab]) {
      return;
    }

    await fetchTabData(targetTab, {
      preserveWizardState: hasData,
      showLoading: true,
    });
  }, [conflictsData, dirtyTabs, fetchTabData, grocyMinStockData, mappedProductsData, productsData, unitsData]);

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
      conflicts: activeTab === 'conflicts'
        ? false
        : prev.conflicts || conflictsData !== null,
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
  const remapMealieFoodOptions = useMemo(() =>
    remapData?.mappingKind === 'product'
      ? sortByName(remapData.mealieFoods).map(food => ({ value: food.id, label: food.name }))
      : [],
    [remapData],
  );
  const remapGrocyProductOptions = useMemo(() =>
    remapData?.mappingKind === 'product'
      ? sortByName(remapData.grocyProducts).map(product => ({ value: product.id, label: product.name }))
      : [],
    [remapData],
  );
  const remapMealieUnitOptions = useMemo(() =>
    remapData?.mappingKind === 'unit'
      ? sortByName(remapData.mealieUnits).map(unit => ({ value: unit.id, label: unit.name }))
      : [],
    [remapData],
  );
  const remapGrocyUnitOptions = useMemo(() =>
    remapData
      ? sortByName(remapData.grocyUnits).map(unit => ({ value: unit.id, label: unit.name }))
      : [],
    [remapData],
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

  function openBulkSuggestionDialog(targetTab: 'units' | 'products' | 'grocy-min-stock') {
    setBulkSuggestionTab(targetTab);
    setBulkSuggestionThreshold('90');
  }

  function closeBulkSuggestionDialog() {
    setBulkSuggestionTab(null);
    setBulkSuggestionThreshold('90');
  }

  function parseBulkSuggestionThreshold(): number | null {
    const parsed = Number.parseInt(bulkSuggestionThreshold, 10);

    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      toast.error('Enter a threshold between 0 and 100');
      return null;
    }

    return parsed;
  }

  function closeConflictRemapDialog() {
    setRemapConflict(null);
    setRemapData(null);
    setRemapProductDraft({
      mealieFoodId: null,
      grocyProductId: null,
      grocyUnitId: null,
    });
    setRemapUnitDraft({
      mealieUnitId: null,
      grocyUnitId: null,
    });
  }

  async function openConflictRemapDialog(conflict: MappingConflictRow) {
    await runAction('loadConflictRemap', async () => {
      const params = new URLSearchParams({
        mappingKind: conflict.mappingKind,
        mappingId: conflict.mappingId,
      });
      const res = await fetch(`/api/mapping-wizard/conflicts/remap?${params.toString()}`);
      const result = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(result?.error || 'Failed to load remap options');
      }

      const data = result as ConflictRemapData;
      setRemapConflict(conflict);
      setRemapData(data);

      if (data.mappingKind === 'product') {
        setRemapProductDraft({
          mealieFoodId: data.mealieFoods.some(food => food.id === data.currentSelection.mealieFoodId)
            ? data.currentSelection.mealieFoodId
            : null,
          grocyProductId: data.grocyProducts.some(product => product.id === data.currentSelection.grocyProductId)
            ? data.currentSelection.grocyProductId
            : null,
          grocyUnitId: data.grocyUnits.some(unit => unit.id === data.currentSelection.grocyUnitId)
            ? data.currentSelection.grocyUnitId
            : null,
        });
        return;
      }

      setRemapUnitDraft({
        mealieUnitId: data.mealieUnits.some(unit => unit.id === data.currentSelection.mealieUnitId)
          ? data.currentSelection.mealieUnitId
          : null,
        grocyUnitId: data.grocyUnits.some(unit => unit.id === data.currentSelection.grocyUnitId)
          ? data.currentSelection.grocyUnitId
          : null,
      });
    });
  }

  async function submitConflictRemap() {
    if (!remapConflict || !remapData) {
      return;
    }

    if (remapData.mappingKind === 'product') {
      if (!remapProductDraft.mealieFoodId || remapProductDraft.grocyProductId === null) {
        toast.info('Select both a Mealie product and a Grocy product');
        return;
      }
    } else if (!remapUnitDraft.mealieUnitId || remapUnitDraft.grocyUnitId === null) {
      toast.info('Select both a Mealie unit and a Grocy unit');
      return;
    }

    await runAction('remapConflict', async () => {
      const payload = remapData.mappingKind === 'product'
        ? {
          mappingKind: 'product' as const,
          mappingId: remapConflict.mappingId,
          mealieFoodId: remapProductDraft.mealieFoodId!,
          grocyProductId: remapProductDraft.grocyProductId!,
          grocyUnitId: remapProductDraft.grocyUnitId,
        }
        : {
          mappingKind: 'unit' as const,
          mappingId: remapConflict.mappingId,
          mealieUnitId: remapUnitDraft.mealieUnitId!,
          grocyUnitId: remapUnitDraft.grocyUnitId!,
        };

      const res = await fetch('/api/mapping-wizard/conflicts/remap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(result?.error || 'Failed to remap conflict');
      }

      await fetchTabData('conflicts', { preserveWizardState: false, showLoading: false });
      markOtherLoadedTabsDirty('conflicts');
      closeConflictRemapDialog();
      toast.success('Conflict remapped');
    });
  }

  // --- Accept Suggestions ---

  const currentProductTargetIds = useMemo(() =>
    Object.fromEntries(Object.entries(productMaps).map(([id, mapping]) => [id, mapping.grocyProductId])),
    [productMaps],
  );
  const currentGrocyMinStockTargetIds = useMemo(() =>
    Object.fromEntries(Object.entries(grocyMinStockProductMaps).map(([id, mapping]) => [id, mapping.mealieFoodId])),
    [grocyMinStockProductMaps],
  );
  const currentUnitTargetIds = useMemo(() =>
    Object.fromEntries(Object.entries(unitMaps).map(([id, mapping]) => [id, mapping.grocyUnitId])),
    [unitMaps],
  );

  function acceptProductSuggestion(id: string) {
    const suggestion = productsData?.productSuggestions[id];
    if (!suggestion) {
      return;
    }

    if (!isSuggestionTargetAvailable({
      sourceId: id,
      targetId: suggestion.grocyProductId,
      currentTargetIdsBySourceId: currentProductTargetIds,
    })) {
      toast.info('That Grocy product is already selected for another row');
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
    setCreateProductChecked(prev => {
      const next = { ...prev };
      delete next[id];
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

    if (!isSuggestionTargetAvailable({
      sourceId: String(grocyProductId),
      targetId: suggestion.mealieFoodId,
      currentTargetIdsBySourceId: currentGrocyMinStockTargetIds,
    })) {
      toast.info('That Mealie product is already selected for another row');
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
    setCreateMealieProductChecked(prev => {
      const next = { ...prev };
      delete next[String(grocyProductId)];
      return next;
    });
  }

  function acceptUnitSuggestion(id: string) {
    const suggestion = unitsData?.unitSuggestions[id];
    if (!suggestion) {
      return;
    }

    if (!isSuggestionTargetAvailable({
      sourceId: id,
      targetId: suggestion.grocyUnitId,
      currentTargetIdsBySourceId: currentUnitTargetIds,
    })) {
      toast.info('That Grocy unit is already selected for another row');
      return;
    }

    setUnitMaps(prev => ({ ...prev, [id]: { mealieUnitId: id, grocyUnitId: suggestion.grocyUnitId } }));
    setCreateUnitChecked(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function applyBulkProductSuggestions(threshold: number) {
    if (!productsData) {
      return;
    }

    const result = applyBulkSuggestions({
      threshold,
      currentTargetIdsBySourceId: currentProductTargetIds,
      suggestionsBySourceId: Object.fromEntries(
        Object.entries(productsData.productSuggestions).map(([id, suggestion]) => [
          id,
          {
            targetId: suggestion.grocyProductId,
            score: suggestion.score,
            ambiguous: suggestion.ambiguous,
          },
        ]),
      ),
    });

    if (result.appliedSourceIds.length === 0) {
      toast.info(`No product suggestions meet the ${threshold}% threshold`);
      return;
    }

    setProductMaps(prev => {
      const next = { ...prev };
      for (const id of result.appliedSourceIds) {
        const suggestion = productsData.productSuggestions[id];
        if (!suggestion) {
          continue;
        }

        next[id] = {
          mealieFoodId: id,
          grocyProductId: suggestion.grocyProductId,
          grocyUnitId: suggestion.suggestedUnitId,
        };
      }
      return next;
    });
    setCreateProductChecked(prev => {
      const next = { ...prev };
      for (const id of result.appliedSourceIds) {
        delete next[id];
      }
      return next;
    });

    toast.success(
      `Filled ${result.appliedSourceIds.length} product suggestions >= ${threshold}%`
      + (result.ambiguousSourceIds.length > 0 ? `, ${result.ambiguousSourceIds.length} need review` : ''),
    );
  }

  function applyBulkGrocyMinStockSuggestions(threshold: number) {
    if (!grocyMinStockData) {
      return;
    }

    const result = applyBulkSuggestions({
      threshold,
      currentTargetIdsBySourceId: currentGrocyMinStockTargetIds,
      suggestionsBySourceId: Object.fromEntries(
        Object.entries(grocyMinStockData.lowStockGrocyProductSuggestions).map(([id, suggestion]) => [
          id,
          {
            targetId: suggestion.mealieFoodId,
            score: suggestion.score,
            ambiguous: suggestion.ambiguous,
          },
        ]),
      ),
    });

    if (result.appliedSourceIds.length === 0) {
      toast.info(`No Grocy min-stock suggestions meet the ${threshold}% threshold`);
      return;
    }

    setGrocyMinStockProductMaps(prev => {
      const next = { ...prev };
      for (const id of result.appliedSourceIds) {
        const suggestion = grocyMinStockData.lowStockGrocyProductSuggestions[id];
        const grocyProduct = grocyMinStockData.unmappedGrocyMinStockProducts.find(product => String(product.id) === id);
        if (!suggestion || !grocyProduct) {
          continue;
        }

        next[id] = {
          grocyProductId: grocyProduct.id,
          mealieFoodId: suggestion.mealieFoodId,
          grocyUnitId: grocyProduct.quIdPurchase || null,
        };
      }
      return next;
    });
    setCreateMealieProductChecked(prev => {
      const next = { ...prev };
      for (const id of result.appliedSourceIds) {
        delete next[id];
      }
      return next;
    });

    toast.success(
      `Filled ${result.appliedSourceIds.length} Grocy min-stock suggestions >= ${threshold}%`
      + (result.ambiguousSourceIds.length > 0 ? `, ${result.ambiguousSourceIds.length} need review` : ''),
    );
  }

  function applyBulkUnitSuggestions(threshold: number) {
    if (!unitsData) {
      return;
    }

    const result = applyBulkSuggestions({
      threshold,
      currentTargetIdsBySourceId: currentUnitTargetIds,
      suggestionsBySourceId: Object.fromEntries(
        Object.entries(unitsData.unitSuggestions).map(([id, suggestion]) => [
          id,
          {
            targetId: suggestion.grocyUnitId,
            score: suggestion.score,
            ambiguous: suggestion.ambiguous,
          },
        ]),
      ),
    });

    if (result.appliedSourceIds.length === 0) {
      toast.info(`No unit suggestions meet the ${threshold}% threshold`);
      return;
    }

    setUnitMaps(prev => {
      const next = { ...prev };
      for (const id of result.appliedSourceIds) {
        const suggestion = unitsData.unitSuggestions[id];
        if (!suggestion) {
          continue;
        }

        next[id] = {
          mealieUnitId: id,
          grocyUnitId: suggestion.grocyUnitId,
        };
      }
      return next;
    });
    setCreateUnitChecked(prev => {
      const next = { ...prev };
      for (const id of result.appliedSourceIds) {
        delete next[id];
      }
      return next;
    });

    toast.success(
      `Filled ${result.appliedSourceIds.length} unit suggestions >= ${threshold}%`
      + (result.ambiguousSourceIds.length > 0 ? `, ${result.ambiguousSourceIds.length} need review` : ''),
    );
  }

  function applyBulkSuggestionsForCurrentTab() {
    const threshold = parseBulkSuggestionThreshold();
    if (threshold === null || !bulkSuggestionTab) {
      return;
    }

    switch (bulkSuggestionTab) {
      case 'products':
        applyBulkProductSuggestions(threshold);
        break;
      case 'grocy-min-stock':
        applyBulkGrocyMinStockSuggestions(threshold);
        break;
      case 'units':
        applyBulkUnitSuggestions(threshold);
        break;
    }

    closeBulkSuggestionDialog();
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
    const filled = unitsData ? getPendingUnitMappings(unitsData, unitMaps) : [];
    if (filled.length === 0) {
      toast.info('No unit changes to sync');
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

  async function unmapUnit(mappingId: string, mealieUnitId: string, mealieUnitName: string) {
    await runAction('unmapUnit', async () => {
      setUnitMaps(prev => ({
        ...prev,
        [mealieUnitId]: {
          mealieUnitId,
          grocyUnitId: null,
        },
      }));

      const res = await fetch('/api/mapping-wizard/units/unmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mappingId }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(result?.error || 'Failed to unmap unit');
      }

      await fetchTabData('units', { preserveWizardState: true, showLoading: false });
      if (tab === 'conflicts') {
        await fetchTabData('conflicts', { preserveWizardState: false, showLoading: false });
      }
      markOtherLoadedTabsDirty('units');
      toast.success(`Unmapped "${mealieUnitName}"`);
    });
  }

  const currentTabLoading = tabLoading[tab];
  const currentTabError = tabErrors[tab];
  const currentTabData = tab === 'units'
    ? unitsData
    : tab === 'products'
      ? productsData
      : tab === 'grocy-min-stock'
        ? grocyMinStockData
        : tab === 'mapped-products'
          ? mappedProductsData
          : conflictsData;
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
      minStockStep: prev.minStockStep,
      mappedProducts: prev.mappedProducts.map(product =>
        product.grocyProductId === grocyProductId
          ? { ...product, minStockAmount }
          : product,
      ),
    }) : prev);
    markOtherLoadedTabsDirty('mapped-products');
    toast.success('Minimum stock updated');
  }

  async function unmapMappedProduct(mappingId: string, productName: string) {
    await runAction('unmapMappedProduct', async () => {
      const res = await fetch('/api/mapping-wizard/products/unmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mappingId }),
      });
      const result = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(result?.error || 'Failed to unmap product');
      }

      await fetchTabData('mapped-products', { preserveWizardState: false, showLoading: false });
      if (tab === 'conflicts') {
        await fetchTabData('conflicts', { preserveWizardState: false, showLoading: false });
      }
      markOtherLoadedTabsDirty('mapped-products');
      toast.success(`Unmapped "${productName}"`);
    });
  }

  async function checkConflicts() {
    await runAction('checkConflicts', async () => {
      const res = await fetch('/api/mapping-wizard/conflicts', { method: 'POST' });
      const result = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(result?.error || 'Failed to check conflicts');
      }

      setConflictsData({ conflicts: result.conflicts });
      setDirtyTabs(prev => ({ ...prev, conflicts: false }));
      toast.success(`Conflict check completed (${result.summary.open} open, ${result.summary.resolved} resolved)`);
    });
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
            unitFilter={unitFilter}
            setUnitFilter={setUnitFilter}
            grocyUnitOptions={unitGrocyUnitOptions}
            actionRunning={actionRunning}
            onAcceptAllSuggestions={() => openBulkSuggestionDialog('units')}
            onAcceptSuggestion={acceptUnitSuggestion}
            onNormalizeUnits={normalizeUnits}
            onUnmapUnit={(mappingId, mealieUnitId, mealieUnitName) => openConfirm(
              `unmapUnit_${mappingId}`,
              `Unmap "${mealieUnitName}"?`,
              () => { void unmapUnit(mappingId, mealieUnitId, mealieUnitName); },
              [mealieUnitName],
              'This removes the saved unit mapping immediately. You can remap it again in the wizard afterwards.',
            )}
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
            onAcceptAllSuggestions={() => openBulkSuggestionDialog('products')}
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
            showOnlyBelowMinimumStock={showOnlyGrocyMinStockBelowMinimum}
            setShowOnlyBelowMinimumStock={setShowOnlyGrocyMinStockBelowMinimum}
            mealieProductOptions={mealieProductOptions}
            grocyUnitOptions={grocyMinStockGrocyUnitOptions}
            actionRunning={actionRunning}
            onAcceptAllSuggestions={() => openBulkSuggestionDialog('grocy-min-stock')}
            onAcceptSuggestion={acceptGrocyMinStockProductSuggestion}
          />
        );
      case 'mapped-products':
        return (
          <MappedProductsTab
            data={mappedProductsData!}
            productSearch={mappedProductSearch}
            setProductSearch={setMappedProductSearch}
            showOnlyBelowMinimumStock={showOnlyMappedProductsBelowMinimum}
            setShowOnlyBelowMinimumStock={setShowOnlyMappedProductsBelowMinimum}
            onUpdateMinStock={updateMappedProductMinStock}
            onUnmapProduct={(mappingId, productName) => openConfirm(
              `unmapProduct_${mappingId}`,
              `Unmap "${productName}"?`,
              () => { void unmapMappedProduct(mappingId, productName); },
              [productName],
              'This removes the saved product mapping immediately. The product will show up in the regular mapping flows again.',
            )}
          />
        );
      case 'conflicts':
        return (
          <ConflictsTab
            data={conflictsData!}
            actionRunning={actionRunning}
            onCheckConflicts={checkConflicts}
            onOpenSourceTab={sourceTab => setTab(sourceTab)}
            onRemapConflict={conflict => { void openConflictRemapDialog(conflict); }}
            onRecheckConflict={() => { void checkConflicts(); }}
            onUnmapConflict={(conflict: MappingConflictRow) => {
              if (conflict.mappingKind === 'unit') {
                openConfirm(
                  `unmapConflict_${conflict.id}`,
                  `Unmap "${conflict.mealieName || conflict.mappingId}"?`,
                  () => {
                    void unmapUnit(
                      conflict.mappingId,
                      conflict.mealieId || conflict.mappingId,
                      conflict.mealieName || conflict.mappingId,
                    );
                  },
                  [conflict.summary],
                  'This removes the saved unit mapping immediately.',
                );
                return;
              }

              openConfirm(
                `unmapConflict_${conflict.id}`,
                `Unmap "${conflict.mealieName || conflict.mappingId}"?`,
                () => {
                  void unmapMappedProduct(
                    conflict.mappingId,
                    conflict.mealieName || conflict.mappingId,
                  );
                },
                [conflict.summary],
                'This removes the saved product mapping immediately.',
              );
            }}
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
                  <TabsTrigger value="conflicts">
                    Conflicts{conflictsData ? ` (${conflictsData.conflicts.length} open)` : ''}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value={tab} className="mt-4 flex min-h-0 min-w-0 flex-1">
                {renderCurrentTab()}
              </TabsContent>
            </Tabs>
          </div>

          {currentTabData && tab !== 'mapped-products' && tab !== 'conflicts' && (
            <WizardFooter
              tab={tab}
              actionRunning={actionRunning}
              unitMappedCount={unitsData ? getPendingUnitMappings(unitsData, unitMaps).length : 0}
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

      <Dialog
        open={remapConflict !== null}
        onOpenChange={value => {
          if (!value && actionRunning !== 'remapConflict' && actionRunning !== 'loadConflictRemap') {
            closeConflictRemapDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Remap Conflict</DialogTitle>
            <DialogDescription>
              {remapConflict?.summary || 'Choose a replacement mapping for this conflict.'}
            </DialogDescription>
          </DialogHeader>

          {remapData?.mappingKind === 'product' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Mealie product</label>
                <SearchableSelect
                  options={remapMealieFoodOptions}
                  value={remapProductDraft.mealieFoodId}
                  onChange={value => setRemapProductDraft(prev => ({ ...prev, mealieFoodId: value }))}
                  placeholder="Select Mealie product..."
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Grocy product</label>
                <SearchableSelect
                  options={remapGrocyProductOptions}
                  value={remapProductDraft.grocyProductId}
                  onChange={value => {
                    setRemapProductDraft(prev => {
                      const selectedProduct = remapData.grocyProducts.find(product => product.id === value);
                      return {
                        ...prev,
                        grocyProductId: value,
                        grocyUnitId: value === null
                          ? prev.grocyUnitId
                          : selectedProduct?.quIdPurchase || prev.grocyUnitId || null,
                      };
                    });
                  }}
                  placeholder="Select Grocy product..."
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Grocy unit</label>
                <SearchableSelect
                  options={remapGrocyUnitOptions}
                  value={remapProductDraft.grocyUnitId}
                  onChange={value => setRemapProductDraft(prev => ({ ...prev, grocyUnitId: value }))}
                  placeholder="Keep unit unmapped"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Optional. If a matching unit mapping exists, it will be linked to this product mapping.
                </p>
              </div>
            </div>
          ) : remapData?.mappingKind === 'unit' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Mealie unit</label>
                <SearchableSelect
                  options={remapMealieUnitOptions}
                  value={remapUnitDraft.mealieUnitId}
                  onChange={value => setRemapUnitDraft(prev => ({ ...prev, mealieUnitId: value }))}
                  placeholder="Select Mealie unit..."
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Grocy unit</label>
                <SearchableSelect
                  options={remapGrocyUnitOptions}
                  value={remapUnitDraft.grocyUnitId}
                  onChange={value => setRemapUnitDraft(prev => ({ ...prev, grocyUnitId: value }))}
                  placeholder="Select Grocy unit..."
                  className="w-full"
                />
              </div>
            </div>
          ) : (
            <div className="py-2 text-sm text-muted-foreground">
              Loading remap options...
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={closeConflictRemapDialog}
              disabled={actionRunning === 'remapConflict' || actionRunning === 'loadConflictRemap'}
            >
              Cancel
            </Button>
            <Button
              onClick={() => { void submitConflictRemap(); }}
              disabled={actionRunning === 'remapConflict' || actionRunning === 'loadConflictRemap'}
            >
              {actionRunning === 'remapConflict' ? 'Saving...' : 'Save Remap'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkSuggestionTab !== null} onOpenChange={open => { if (!open) closeBulkSuggestionDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fill Suggestions</DialogTitle>
            <DialogDescription>
              Fill the best suggestions for the current tab using a temporary minimum score.
              Existing selections are kept and targets stay one-to-one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="bulk-suggestion-threshold" className="text-sm font-medium">
              Minimum score (%)
            </label>
            <Input
              id="bulk-suggestion-threshold"
              type="number"
              min={0}
              max={100}
              value={bulkSuggestionThreshold}
              onChange={event => setBulkSuggestionThreshold(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Default is 90. Ambiguous rows can still be filled, but they will show a warning icon for review.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={closeBulkSuggestionDialog}>
              Cancel
            </Button>
            <Button onClick={applyBulkSuggestionsForCurrentTab}>
              Fill Suggestions
            </Button>
          </DialogFooter>
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

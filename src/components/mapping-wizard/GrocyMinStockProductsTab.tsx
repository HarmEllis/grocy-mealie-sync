'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Save } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { SuggestionScoreIndicator } from './SuggestionScoreIndicator';
import type {
  GrocyMinStockProduct,
  GrocyMinStockProductMapping,
  GrocyMinStockTabData,
  ReverseProductSuggestion,
  SelectOption,
} from './types';
import { sortByName } from './types';
import { isBelowMinimumStock } from './stock';
import { buildTakenTargetIds } from './state';
import { buildPageWindow, DEFAULT_PAGE_SIZE } from './paging';
import { Pagination } from './Pagination';

interface MinStockRowProps {
  product: GrocyMinStockProduct;
  mapping: GrocyMinStockProductMapping | undefined;
  suggestion: ReverseProductSuggestion | undefined;
  checked: boolean;
  draftValue: string;
  isSaving: boolean;
  minStockStep: string;
  selectedMealieFoodLabel: string | null;
  mealieProductOptions: SelectOption<string>[];
  grocyUnitOptions: SelectOption[];
  isMealieFoodTaken: (id: string) => boolean;
  onToggleChecked: (productKey: string, checked: boolean) => void;
  onDraftChange: (grocyProductId: number, value: string) => void;
  onSaveMinStock: (grocyProductId: number) => void;
  onSelectMealieFood: (product: GrocyMinStockProduct, mealieFoodId: string | null) => void;
  onSelectUnit: (productKey: string, grocyUnitId: number | null) => void;
  onAcceptSuggestion: (grocyProductId: number) => void;
}

/**
 * Memoised for the same reason as `ProductRow` in ProductsTab: without it a
 * single checkbox re-rendered all ~100 comboboxes on the page.
 */
const MinStockRow = memo(function MinStockRow({
  product,
  mapping,
  suggestion,
  checked,
  draftValue,
  isSaving,
  minStockStep,
  selectedMealieFoodLabel,
  mealieProductOptions,
  grocyUnitOptions,
  isMealieFoodTaken,
  onToggleChecked,
  onDraftChange,
  onSaveMinStock,
  onSelectMealieFood,
  onSelectUnit,
  onAcceptSuggestion,
}: MinStockRowProps) {
  const productKey = String(product.id);
  const selectedMealieFoodId = mapping?.mealieFoodId ?? null;
  const isAccepted = selectedMealieFoodId !== null;
  const parsedDraft = Number(draftValue);
  const isInvalid = !Number.isFinite(parsedDraft) || parsedDraft < 0;
  const isDirty = !isInvalid && parsedDraft !== product.minStockAmount;

  return (
    <TableRow className={isAccepted ? 'bg-success/5' : undefined}>
      <TableCell className="text-center">
        {!isAccepted && (
          <Checkbox
            checked={checked}
            onCheckedChange={(next: boolean) => onToggleChecked(productKey, next)}
          />
        )}
      </TableCell>
      <TableCell className="font-medium">{product.name}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="number"
            min="0"
            step={minStockStep}
            value={draftValue}
            onChange={event => onDraftChange(product.id, event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && isDirty && !isSaving) {
                event.preventDefault();
                onSaveMinStock(product.id);
              }
            }}
            className="h-8 min-w-[11rem]"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => onSaveMinStock(product.id)}
            disabled={isSaving || !isDirty}
            aria-label={`Save minimum stock for ${product.name}`}
            title={`Save minimum stock for ${product.name}`}
            className="w-full sm:w-auto sm:shrink-0"
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <SearchableSelect
          options={mealieProductOptions}
          isValueExcluded={isMealieFoodTaken}
          extraOption={selectedMealieFoodId !== null && selectedMealieFoodLabel !== null
            ? { value: selectedMealieFoodId, label: selectedMealieFoodLabel }
            : null}
          value={selectedMealieFoodId}
          onChange={value => onSelectMealieFood(product, typeof value === 'string' ? value : null)}
          placeholder="Select Mealie product..."
          className="max-w-[260px]"
        />
      </TableCell>
      <TableCell>
        <SearchableSelect
          options={grocyUnitOptions}
          value={mapping?.grocyUnitId ?? null}
          onChange={value => onSelectUnit(productKey, value)}
          placeholder="Select Grocy unit..."
          className="max-w-[160px]"
        />
      </TableCell>
      <TableCell>
        {suggestion ? (
          <SuggestionScoreIndicator
            score={suggestion.score}
            ambiguous={suggestion.ambiguous}
            runnerUp={suggestion.runnerUp}
            acceptTitle={`Accept: ${suggestion.mealieFoodName}`}
            onAccept={!isAccepted ? () => onAcceptSuggestion(product.id) : undefined}
          />
        ) : null}
      </TableCell>
    </TableRow>
  );
});

interface GrocyMinStockProductsTabProps {
  data: GrocyMinStockTabData;
  productMaps: Record<string, GrocyMinStockProductMapping>;
  setProductMaps: React.Dispatch<React.SetStateAction<Record<string, GrocyMinStockProductMapping>>>;
  createProductChecked: Record<string, boolean>;
  setCreateProductChecked: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  productSearch: string;
  setProductSearch: (value: string) => void;
  showOnlyBelowMinimumStock: boolean;
  setShowOnlyBelowMinimumStock: (value: boolean) => void;
  mealieProductOptions: SelectOption<string>[];
  grocyUnitOptions: SelectOption[];
  actionRunning: string | null;
  onAcceptAllSuggestions: () => void;
  onAcceptSuggestion: (grocyProductId: number) => void;
  onUpdateMinStock: (grocyProductId: number, minStockAmount: number) => Promise<void>;
}

export function GrocyMinStockProductsTab({
  data,
  productMaps,
  setProductMaps,
  createProductChecked,
  setCreateProductChecked,
  productSearch,
  setProductSearch,
  showOnlyBelowMinimumStock,
  setShowOnlyBelowMinimumStock,
  mealieProductOptions,
  grocyUnitOptions,
  actionRunning,
  onAcceptAllSuggestions,
  onAcceptSuggestion,
  onUpdateMinStock,
}: GrocyMinStockProductsTabProps) {
  const isRunning = !!actionRunning;
  const [draftMinStock, setDraftMinStock] = useState<Record<number, string>>({});
  const [savingGrocyProductId, setSavingGrocyProductId] = useState<number | null>(null);

  useEffect(() => {
    setDraftMinStock(
      Object.fromEntries(
        data.unmappedGrocyMinStockProducts.map(product => [product.id, String(product.minStockAmount)]),
      ),
    );
  }, [data]);

  const belowMinimumCount = useMemo(() =>
    data.unmappedGrocyMinStockProducts.filter(product =>
      isBelowMinimumStock(product.currentStock, product.minStockAmount, product.isBelowMinimum),
    ).length,
    [data],
  );

  const filteredProducts = useMemo(() => {
    const sorted = sortByName(data.unmappedGrocyMinStockProducts);
    const q = productSearch.toLowerCase();
    return sorted.filter(product => {
      if (showOnlyBelowMinimumStock && !isBelowMinimumStock(
        product.currentStock,
        product.minStockAmount,
        product.isBelowMinimum,
      )) {
        return false;
      }

      if (!productSearch) {
        return true;
      }

      return product.name.toLowerCase().includes(q);
    });
  }, [data, productSearch, showOnlyBelowMinimumStock]);

  const unmappedProductIds = useMemo(() =>
    Object.entries(productMaps)
      .filter(([, mapping]) => mapping.mealieFoodId === null)
      .map(([id]) => id),
    [productMaps],
  );

  const visibleUnmappedProductIds = useMemo(() => {
    const unmappedSet = new Set(unmappedProductIds);
    return filteredProducts
      .filter(product => unmappedSet.has(String(product.id)))
      .map(product => String(product.id));
  }, [filteredProducts, unmappedProductIds]);

  const selectedMealieFoodIds = useMemo(
    () => buildTakenTargetIds(productMaps, mapping => mapping.mealieFoodId),
    [productMaps],
  );

  // Read through a ref so the callback identity never changes: a fresh
  // callback would re-render every row on every pick.
  const selectedMealieFoodIdsRef = useRef(selectedMealieFoodIds);
  useEffect(() => { selectedMealieFoodIdsRef.current = selectedMealieFoodIds; }, [selectedMealieFoodIds]);
  const isMealieFoodTaken = useCallback(
    (id: string) => selectedMealieFoodIdsRef.current.has(id),
    [],
  );

  // `saveMinStock` and `onAcceptSuggestion` are re-created on every render;
  // routing them through a ref keeps the row props stable.
  const saveMinStockRef = useRef(saveMinStock);
  useEffect(() => { saveMinStockRef.current = saveMinStock; });
  const handleSaveMinStock = useCallback((grocyProductId: number) => {
    void saveMinStockRef.current(grocyProductId);
  }, []);

  const acceptSuggestionRef = useRef(onAcceptSuggestion);
  useEffect(() => { acceptSuggestionRef.current = onAcceptSuggestion; }, [onAcceptSuggestion]);
  const handleAcceptSuggestion = useCallback((grocyProductId: number) => {
    acceptSuggestionRef.current(grocyProductId);
  }, []);

  const handleToggleChecked = useCallback((productKey: string, next: boolean) => {
    setCreateProductChecked(prev => ({ ...prev, [productKey]: next }));
  }, [setCreateProductChecked]);

  const selectableUnitIds = useMemo(
    () => new Set(grocyUnitOptions.map(option => option.value)),
    [grocyUnitOptions],
  );

  const handleDraftChange = useCallback((grocyProductId: number, value: string) => {
    setDraftMinStock(prev => ({ ...prev, [grocyProductId]: value }));
  }, []);

  const handleSelectMealieFood = useCallback((product: GrocyMinStockProduct, mealieFoodId: string | null) => {
    const productKey = String(product.id);
    // Only a mapped unit can be stored on a product mapping, so an unmappable
    // purchase unit must not be prefilled: it is not in the dropdown either,
    // and the sync would drop it without saying so.
    const purchaseUnitId = product.quIdPurchase && selectableUnitIds.has(product.quIdPurchase)
      ? product.quIdPurchase
      : null;
    setProductMaps(prev => ({
      ...prev,
      [productKey]: {
        ...prev[productKey],
        mealieFoodId,
        grocyUnitId: purchaseUnitId || prev[productKey]?.grocyUnitId || null,
      },
    }));
    if (mealieFoodId !== null) {
      setCreateProductChecked(prev => {
        const next = { ...prev };
        delete next[productKey];
        return next;
      });
    }
  }, [selectableUnitIds, setProductMaps, setCreateProductChecked]);

  const handleSelectUnit = useCallback((productKey: string, grocyUnitId: number | null) => {
    setProductMaps(prev => ({
      ...prev,
      [productKey]: { ...prev[productKey], grocyUnitId },
    }));
  }, [setProductMaps]);

  const mealieProductLabelById = useMemo(
    () => new Map(mealieProductOptions.map(option => [option.value, option.label])),
    [mealieProductOptions],
  );

  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  useEffect(() => { setOffset(0); }, [productSearch, showOnlyBelowMinimumStock]);

  const pageWindow = useMemo(
    () => buildPageWindow(filteredProducts, offset, pageSize),
    [filteredProducts, offset, pageSize],
  );

  const allVisibleProductsChecked = visibleUnmappedProductIds.length > 0 && visibleUnmappedProductIds.every(id => createProductChecked[id]);

  async function saveMinStock(grocyProductId: number) {
    const rawValue = draftMinStock[grocyProductId] ?? '0';
    const nextValue = Number(rawValue);

    if (!Number.isFinite(nextValue) || nextValue < 0) {
      return;
    }

    setSavingGrocyProductId(grocyProductId);
    try {
      await onUpdateMinStock(grocyProductId, nextValue);
    } finally {
      setSavingGrocyProductId(current => (current === grocyProductId ? null : current));
    }
  }

  if (data.unmappedGrocyMinStockProducts.length === 0) {
    return (
      <Alert className="border-success/30 bg-success/10">
        <CheckCircle2 className="size-4 text-success" />
        <AlertDescription className="text-success">
          All Grocy products with a minimum stock are mapped.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {Object.keys(data.lowStockGrocyProductSuggestions).length > 0 && (
          <Button variant="secondary" onClick={onAcceptAllSuggestions} disabled={isRunning}>
            Fill Suggestions... ({Object.keys(data.lowStockGrocyProductSuggestions).length})
          </Button>
        )}
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={showOnlyBelowMinimumStock}
            onCheckedChange={(checked: boolean) => setShowOnlyBelowMinimumStock(checked)}
          />
          <span>Only currently below minimum ({belowMinimumCount})</span>
        </label>
        <Input
          placeholder="Filter Grocy min-stock products..."
          value={productSearch}
          onChange={e => setProductSearch(e.target.value)}
          className="max-w-[280px]"
        />
      </div>

      <div className="min-h-0 min-w-0 flex-1 rounded-md border">
        <Table className="min-w-[1040px]" containerClassName="h-full min-w-0">
          <TableHeader>
            <TableRow>
              <TableHead className="w-9 text-center">
                <Checkbox
                  checked={allVisibleProductsChecked}
                  onCheckedChange={(checked: boolean) => {
                    setCreateProductChecked(prev => {
                      const next = { ...prev };
                      for (const id of visibleUnmappedProductIds) next[id] = checked;
                      return next;
                    });
                  }}
                />
              </TableHead>
              <TableHead>Grocy Product</TableHead>
              <TableHead className="w-[220px]">Min Stock</TableHead>
              <TableHead className="w-[35%]">Mealie Product</TableHead>
              <TableHead className="w-[20%]">Unit</TableHead>
              <TableHead className="w-[70px]">Match</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageWindow.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                  No Grocy min-stock products match the current filters.
                </TableCell>
              </TableRow>
            )}
            {pageWindow.rows.map(product => (
              <MinStockRow
                key={product.id}
                product={product}
                mapping={productMaps[String(product.id)]}
                suggestion={data.lowStockGrocyProductSuggestions[String(product.id)]}
                checked={!!createProductChecked[String(product.id)]}
                draftValue={draftMinStock[product.id] ?? String(product.minStockAmount)}
                isSaving={savingGrocyProductId === product.id}
                minStockStep={data.minStockStep}
                selectedMealieFoodLabel={
                  productMaps[String(product.id)]?.mealieFoodId != null
                    ? mealieProductLabelById.get(productMaps[String(product.id)].mealieFoodId!) ?? null
                    : null
                }
                mealieProductOptions={mealieProductOptions}
                grocyUnitOptions={grocyUnitOptions}
                isMealieFoodTaken={isMealieFoodTaken}
                onToggleChecked={handleToggleChecked}
                onDraftChange={handleDraftChange}
                onSaveMinStock={handleSaveMinStock}
                onSelectMealieFood={handleSelectMealieFood}
                onSelectUnit={handleSelectUnit}
                onAcceptSuggestion={handleAcceptSuggestion}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination
        window={pageWindow}
        onOffsetChange={setOffset}
        onPageSizeChange={size => { setPageSize(size); setOffset(0); }}
        disabled={isRunning}
        itemLabel="products"
      />
    </div>
  );
}

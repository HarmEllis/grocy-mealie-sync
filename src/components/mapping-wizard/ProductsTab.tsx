'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2 } from 'lucide-react';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { SuggestionScoreIndicator } from './SuggestionScoreIndicator';
import type { ProductsTabData, ProductMapping, ProductSuggestion, SelectOption } from './types';
import { sortByName } from './types';
import { buildTakenTargetIds } from './state';
import { buildPageWindow, DEFAULT_PAGE_SIZE } from './paging';
import { Pagination } from './Pagination';

interface ProductRowProps {
  food: { id: string; name: string };
  mapping: ProductMapping | undefined;
  suggestion: ProductSuggestion | undefined;
  checked: boolean;
  selectedProductLabel: string | null;
  grocyProductOptions: SelectOption[];
  grocyUnitOptions: SelectOption[];
  isGrocyProductTaken: (id: number) => boolean;
  unitPlaceholder: string;
  onToggleChecked: (foodId: string, checked: boolean) => void;
  onSelectProduct: (foodId: string, grocyProductId: number | null) => void;
  onSelectUnit: (foodId: string, grocyUnitId: number | null) => void;
  onAcceptSuggestion: (foodId: string) => void;
}

/**
 * Memoised so that editing one row leaves the other 49 alone.
 *
 * Without this, ticking a checkbox re-rendered every row on the page, and each
 * row mounts two comboboxes — ~100 base-ui `Combobox.Root` re-renders for a
 * single click. Every prop here is either a primitive or something the parent
 * keeps stable across renders; `isGrocyProductTaken` in particular is a
 * callback rather than a set for exactly that reason.
 */
const ProductRow = memo(function ProductRow({
  food,
  mapping,
  suggestion,
  checked,
  selectedProductLabel,
  grocyProductOptions,
  grocyUnitOptions,
  isGrocyProductTaken,
  unitPlaceholder,
  onToggleChecked,
  onSelectProduct,
  onSelectUnit,
  onAcceptSuggestion,
}: ProductRowProps) {
  const selectedProductId = mapping?.grocyProductId ?? null;
  const isAccepted = selectedProductId !== null;

  return (
    <TableRow className={isAccepted ? 'bg-success/5' : undefined}>
      <TableCell className="text-center">
        {!isAccepted && (
          <Checkbox
            checked={checked}
            onCheckedChange={(next: boolean) => onToggleChecked(food.id, next)}
          />
        )}
      </TableCell>
      <TableCell className="font-medium">{food.name}</TableCell>
      <TableCell>
        <SearchableSelect
          options={grocyProductOptions}
          isValueExcluded={isGrocyProductTaken}
          extraOption={selectedProductId !== null && selectedProductLabel !== null
            ? { value: selectedProductId, label: selectedProductLabel }
            : null}
          value={selectedProductId}
          onChange={val => onSelectProduct(food.id, val)}
          placeholder="Select Grocy product..."
          className="max-w-[260px]"
        />
      </TableCell>
      <TableCell>
        <SearchableSelect
          options={grocyUnitOptions}
          value={mapping?.grocyUnitId ?? null}
          onChange={val => onSelectUnit(food.id, val)}
          placeholder={unitPlaceholder}
          className="max-w-[160px]"
        />
      </TableCell>
      <TableCell>
        {suggestion ? (
          <SuggestionScoreIndicator
            score={suggestion.score}
            ambiguous={suggestion.ambiguous}
            runnerUp={suggestion.runnerUp}
            acceptTitle={`Accept: ${suggestion.grocyProductName}`}
            onAccept={!isAccepted ? () => onAcceptSuggestion(food.id) : undefined}
          />
        ) : null}
      </TableCell>
    </TableRow>
  );
});

interface ProductsTabProps {
  data: ProductsTabData;
  productMaps: Record<string, ProductMapping>;
  setProductMaps: React.Dispatch<React.SetStateAction<Record<string, ProductMapping>>>;
  createProductChecked: Record<string, boolean>;
  setCreateProductChecked: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  productSearch: string;
  setProductSearch: (value: string) => void;
  grocyProductOptions: SelectOption[];
  mappedUnitOptions: SelectOption[];
  defaultCreateUnitId: number | null;
  setDefaultCreateUnitId: (value: number | null) => void;
  actionRunning: string | null;
  onAcceptAllSuggestions: () => void;
  onAcceptSuggestion: (id: string) => void;
  onNormalizeProducts: () => void;
}

export function ProductsTab({
  data,
  productMaps,
  setProductMaps,
  createProductChecked,
  setCreateProductChecked,
  productSearch,
  setProductSearch,
  grocyProductOptions,
  mappedUnitOptions,
  defaultCreateUnitId,
  setDefaultCreateUnitId,
  actionRunning,
  onAcceptAllSuggestions,
  onAcceptSuggestion,
  onNormalizeProducts,
}: ProductsTabProps) {
  const isRunning = !!actionRunning;

  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  const filteredFoods = useMemo(() => {
    const sorted = sortByName(data.unmappedMealieFoods);
    if (!productSearch) return sorted;
    const q = productSearch.toLowerCase();
    return sorted.filter(f => f.name.toLowerCase().includes(q));
  }, [data.unmappedMealieFoods, productSearch]);

  // A narrowed filter must not leave the user stranded on a now-empty page.
  useEffect(() => { setOffset(0); }, [productSearch]);

  const pageWindow = useMemo(
    () => buildPageWindow(filteredFoods, offset, pageSize),
    [filteredFoods, offset, pageSize],
  );

  // One shared option array for every row. Rows hide each other's picks via
  // `isValueExcluded` and get their own back via `extraOption`, so `options`
  // keeps a stable identity: selecting a product re-computes only that row.
  const takenGrocyProductIds = useMemo(
    () => buildTakenTargetIds(productMaps, mapping => mapping.grocyProductId),
    [productMaps],
  );

  // Read through a ref so the callback identity never changes: a fresh
  // callback would re-render every memoised row on every pick.
  const takenGrocyProductIdsRef = useRef(takenGrocyProductIds);
  useEffect(() => { takenGrocyProductIdsRef.current = takenGrocyProductIds; }, [takenGrocyProductIds]);
  const isGrocyProductTaken = useCallback(
    (id: number) => takenGrocyProductIdsRef.current.has(id),
    [],
  );

  const selectableUnitIds = useMemo(
    () => new Set(mappedUnitOptions.map(option => option.value)),
    [mappedUnitOptions],
  );

  const grocyProductById = useMemo(
    () => new Map(data.grocyProducts.map(product => [product.id, product])),
    [data.grocyProducts],
  );

  const acceptSuggestionRef = useRef(onAcceptSuggestion);
  useEffect(() => { acceptSuggestionRef.current = onAcceptSuggestion; }, [onAcceptSuggestion]);
  const handleAcceptSuggestion = useCallback((foodId: string) => acceptSuggestionRef.current(foodId), []);

  const handleToggleChecked = useCallback((foodId: string, next: boolean) => {
    setCreateProductChecked(prev => ({ ...prev, [foodId]: next }));
  }, [setCreateProductChecked]);

  const handleSelectProduct = useCallback((foodId: string, grocyProductId: number | null) => {
    const grocyProduct = grocyProductId === null ? undefined : grocyProductById.get(grocyProductId);
    // Prefill the Grocy product's purchase unit only when it is mappable.
    // An unmapped one cannot be stored, and filling it in would show a unit
    // the dropdown does not list and the sync would drop.
    const purchaseUnitId = grocyProduct?.quIdPurchase && selectableUnitIds.has(grocyProduct.quIdPurchase)
      ? grocyProduct.quIdPurchase
      : null;
    setProductMaps(prev => ({
      ...prev,
      [foodId]: {
        ...prev[foodId],
        grocyProductId,
        grocyUnitId: purchaseUnitId || prev[foodId]?.grocyUnitId || null,
      },
    }));
    if (grocyProductId !== null) {
      setCreateProductChecked(prev => {
        const next = { ...prev };
        delete next[foodId];
        return next;
      });
    }
  }, [grocyProductById, selectableUnitIds, setProductMaps, setCreateProductChecked]);

  const handleSelectUnit = useCallback((foodId: string, grocyUnitId: number | null) => {
    setProductMaps(prev => ({ ...prev, [foodId]: { ...prev[foodId], grocyUnitId } }));
  }, [setProductMaps]);

  const grocyProductLabelById = useMemo(
    () => new Map(grocyProductOptions.map(option => [option.value, option.label])),
    [grocyProductOptions],
  );

  const unmappedProductIds = useMemo(() =>
    Object.entries(productMaps).filter(([, m]) => m.grocyProductId === null).map(([id]) => id),
    [productMaps],
  );

  const visibleUnmappedProductIds = useMemo(() => {
    const unmappedSet = new Set(unmappedProductIds);
    return filteredFoods.filter(f => unmappedSet.has(f.id)).map(f => f.id);
  }, [unmappedProductIds, filteredFoods]);

  const allVisibleProductsChecked = visibleUnmappedProductIds.length > 0 && visibleUnmappedProductIds.every(id => createProductChecked[id]);
  const checkedProductCount = unmappedProductIds.filter(id => createProductChecked[id]).length;
  const productMappedCount = Object.values(productMaps).filter(m => m.grocyProductId !== null).length;

  const defaultUnitName = defaultCreateUnitId && data
    ? data.existingUnitMappings.find(m => m.grocyUnitId === defaultCreateUnitId)?.grocyUnitName
    : undefined;
  const unitPlaceholder = defaultUnitName ? `Default: ${defaultUnitName}` : 'Unit...';

  if (data.unmappedMealieFoods.length === 0) {
    return (
      <Alert className="border-success/30 bg-success/10">
        <CheckCircle2 className="size-4 text-success" />
        <AlertDescription className="text-success">
          All Mealie products are mapped. Auto-sync will handle new products from here.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-3">
      {/* Default unit setting */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <label className="text-sm text-muted-foreground whitespace-nowrap">
          Default unit for new products:
        </label>
        <SearchableSelect
          options={mappedUnitOptions}
          value={defaultCreateUnitId}
          onChange={setDefaultCreateUnitId}
          placeholder="Select unit..."
          className="min-w-[160px] max-w-[220px]"
        />
        <span className="text-xs text-muted-foreground">
          Used when unit column is empty
        </span>
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-2">
        {Object.keys(data.productSuggestions).length > 0 && (
          <Button variant="secondary" onClick={onAcceptAllSuggestions} disabled={isRunning}>
            Fill Suggestions... ({Object.keys(data.productSuggestions).length})
          </Button>
        )}
        <Button variant="outline" onClick={onNormalizeProducts} disabled={isRunning}>
          Normalize (Capitalize)
        </Button>
        <Input
          placeholder="Filter Mealie products..."
          value={productSearch}
          onChange={e => setProductSearch(e.target.value)}
          className="max-w-[250px]"
        />
      </div>

      {/* Table */}
      <div className="min-h-0 min-w-0 flex-1 rounded-md border">
        <Table className="min-w-[920px]" containerClassName="h-full min-w-0">
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
              <TableHead>Mealie Product</TableHead>
              <TableHead className="w-[35%]">Grocy Product</TableHead>
              <TableHead className="w-[20%]">Unit</TableHead>
              <TableHead className="w-[70px]">Match</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageWindow.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                  No Mealie products match the current filter.
                </TableCell>
              </TableRow>
            )}
            {pageWindow.rows.map(food => (
              <ProductRow
                key={food.id}
                food={food}
                mapping={productMaps[food.id]}
                suggestion={data.productSuggestions[food.id]}
                checked={!!createProductChecked[food.id]}
                selectedProductLabel={
                  productMaps[food.id]?.grocyProductId != null
                    ? grocyProductLabelById.get(productMaps[food.id].grocyProductId!) ?? null
                    : null
                }
                grocyProductOptions={grocyProductOptions}
                grocyUnitOptions={mappedUnitOptions}
                isGrocyProductTaken={isGrocyProductTaken}
                unitPlaceholder={unitPlaceholder}
                onToggleChecked={handleToggleChecked}
                onSelectProduct={handleSelectProduct}
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

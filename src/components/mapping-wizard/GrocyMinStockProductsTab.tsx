'use client';

import { useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { ScoreBadge } from '@/components/shared/ScoreBadge';
import type { GrocyMinStockProductMapping, GrocyMinStockTabData, SelectOption } from './types';
import { sortByName } from './types';
import { isBelowMinimumStock } from './stock';

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
}: GrocyMinStockProductsTabProps) {
  const isRunning = !!actionRunning;

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

  const selectedMealieFoodIds = useMemo(() =>
    new Set(
      Object.values(productMaps)
        .map(mapping => mapping.mealieFoodId)
        .filter((id): id is string => id !== null),
    ),
    [productMaps],
  );

  const allVisibleProductsChecked = visibleUnmappedProductIds.length > 0 && visibleUnmappedProductIds.every(id => createProductChecked[id]);

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
          <Button variant="secondary" size="sm" onClick={onAcceptAllSuggestions} disabled={isRunning}>
            Accept All Suggestions ({Object.keys(data.lowStockGrocyProductSuggestions).length})
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
              <TableHead>Grocy Product</TableHead>
              <TableHead className="w-[120px]">Min Stock</TableHead>
              <TableHead className="w-[35%]">Mealie Product</TableHead>
              <TableHead className="w-[20%]">Unit</TableHead>
              <TableHead className="w-[70px]">Match</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                  No Grocy min-stock products match the current filters.
                </TableCell>
              </TableRow>
            )}
            {filteredProducts.map(product => {
              const productKey = String(product.id);
              const mapping = productMaps[productKey];
              const suggestion = data.lowStockGrocyProductSuggestions[productKey];
              const isAccepted = mapping?.mealieFoodId !== null;
              const rowOptions = mealieProductOptions.filter(option =>
                option.value === mapping?.mealieFoodId || !selectedMealieFoodIds.has(option.value),
              );

              return (
                <TableRow key={product.id} className={isAccepted ? 'bg-success/5' : undefined}>
                  <TableCell className="text-center">
                    {!isAccepted && (
                      <Checkbox
                        checked={!!createProductChecked[productKey]}
                        onCheckedChange={(checked: boolean) => setCreateProductChecked(prev => ({ ...prev, [productKey]: checked }))}
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-muted-foreground">{product.minStockAmount}</TableCell>
                  <TableCell>
                    <SearchableSelect
                      options={rowOptions}
                      value={mapping?.mealieFoodId ?? null}
                      onChange={value => {
                        setProductMaps(prev => ({
                          ...prev,
                          [productKey]: {
                            ...prev[productKey],
                            mealieFoodId: typeof value === 'string' ? value : null,
                            grocyUnitId: product.quIdPurchase || prev[productKey]?.grocyUnitId || null,
                          },
                        }));
                        if (value !== null) {
                          setCreateProductChecked(prev => {
                            const next = { ...prev };
                            delete next[productKey];
                            return next;
                          });
                        }
                      }}
                      placeholder="Select Mealie product..."
                      className="max-w-[260px]"
                    />
                  </TableCell>
                  <TableCell>
                    <SearchableSelect
                      options={grocyUnitOptions}
                      value={mapping?.grocyUnitId ?? null}
                      onChange={value => setProductMaps(prev => ({
                        ...prev,
                        [productKey]: {
                          ...prev[productKey],
                          grocyUnitId: value,
                        },
                      }))}
                      placeholder="Select Grocy unit..."
                      className="max-w-[160px]"
                    />
                  </TableCell>
                  <TableCell>
                    {suggestion && !isAccepted ? (
                      <button
                        className="cursor-pointer"
                        onClick={() => onAcceptSuggestion(product.id)}
                        title={`Accept: ${suggestion.mealieFoodName}`}
                      >
                        <ScoreBadge score={suggestion.score} />
                      </button>
                    ) : suggestion ? (
                      <ScoreBadge score={suggestion.score} />
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

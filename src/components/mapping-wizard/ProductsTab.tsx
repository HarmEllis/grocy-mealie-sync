'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2 } from 'lucide-react';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { ScoreBadge } from '@/components/shared/ScoreBadge';
import type { WizardData, ProductMapping, SelectOption } from './types';
import { sortByName } from './types';

interface ProductsTabProps {
  data: WizardData;
  productMaps: Record<string, ProductMapping>;
  setProductMaps: React.Dispatch<React.SetStateAction<Record<string, ProductMapping>>>;
  createProductChecked: Record<string, boolean>;
  setCreateProductChecked: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  productSearch: string;
  setProductSearch: (value: string) => void;
  grocyProductOptions: SelectOption[];
  grocyUnitOptions: SelectOption[];
  defaultCreateUnitId: number | null;
  setDefaultCreateUnitId: (value: number | null) => void;
  actionRunning: string | null;
  onAcceptAllSuggestions: () => void;
  onAcceptSuggestion: (id: string) => void;
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
  grocyUnitOptions,
  defaultCreateUnitId,
  setDefaultCreateUnitId,
  actionRunning,
  onAcceptAllSuggestions,
  onAcceptSuggestion,
}: ProductsTabProps) {
  const isRunning = !!actionRunning;

  const filteredFoods = useMemo(() => {
    const sorted = sortByName(data.unmappedMealieFoods);
    if (!productSearch) return sorted;
    const q = productSearch.toLowerCase();
    return sorted.filter(f => f.name.toLowerCase().includes(q));
  }, [data, productSearch]);

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
    ? data.grocyUnits.find(u => u.id === defaultCreateUnitId)?.name
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
    <div className="space-y-3">
      {/* Default unit setting */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <label className="text-sm text-muted-foreground whitespace-nowrap">
          Default unit for new products:
        </label>
        <SearchableSelect
          options={grocyUnitOptions}
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
          <Button variant="secondary" size="sm" onClick={onAcceptAllSuggestions} disabled={isRunning}>
            Accept All Suggestions ({Object.keys(data.productSuggestions).length})
          </Button>
        )}
        <Input
          placeholder="Filter Mealie products..."
          value={productSearch}
          onChange={e => setProductSearch(e.target.value)}
          className="max-w-[250px]"
        />
      </div>

      {/* Table */}
      <ScrollArea className="max-h-[400px] rounded-md border">
        <Table>
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
            {filteredFoods.map(food => {
              const mapping = productMaps[food.id];
              const suggestion = data.productSuggestions[food.id];
              const isAccepted = mapping?.grocyProductId !== null;
              return (
                <TableRow key={food.id} className={isAccepted ? 'bg-success/5' : undefined}>
                  <TableCell className="text-center">
                    {!isAccepted && (
                      <Checkbox
                        checked={!!createProductChecked[food.id]}
                        onCheckedChange={(checked: boolean) => setCreateProductChecked(prev => ({ ...prev, [food.id]: checked }))}
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{food.name}</TableCell>
                  <TableCell>
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
                      className="max-w-[280px]"
                    />
                  </TableCell>
                  <TableCell>
                    <SearchableSelect
                      options={grocyUnitOptions}
                      value={mapping?.grocyUnitId ?? null}
                      onChange={val => setProductMaps(prev => ({
                        ...prev,
                        [food.id]: { ...prev[food.id], grocyUnitId: val },
                      }))}
                      placeholder={unitPlaceholder}
                      className="max-w-[180px]"
                    />
                  </TableCell>
                  <TableCell>
                    {suggestion && !isAccepted ? (
                      <button
                        className="cursor-pointer"
                        onClick={() => onAcceptSuggestion(food.id)}
                        title={`Accept: ${suggestion.grocyProductName}`}
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
      </ScrollArea>

    </div>
  );
}

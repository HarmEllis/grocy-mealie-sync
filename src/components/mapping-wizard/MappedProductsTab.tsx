'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { MappedProductsTabData } from './types';
import { isBelowMinimumStock } from './stock';

interface MappedProductsTabProps {
  data: MappedProductsTabData;
  productSearch: string;
  setProductSearch: (value: string) => void;
  showOnlyBelowMinimumStock: boolean;
  setShowOnlyBelowMinimumStock: (value: boolean) => void;
  onUpdateMinStock: (grocyProductId: number, minStockAmount: number) => Promise<void>;
  onUnmapProduct: (mappingId: string, productName: string) => void;
}

function formatAmount(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2).replace(/\.?0+$/, '');
}

export function MappedProductsTab({
  data,
  productSearch,
  setProductSearch,
  showOnlyBelowMinimumStock,
  setShowOnlyBelowMinimumStock,
  onUpdateMinStock,
  onUnmapProduct,
}: MappedProductsTabProps) {
  const [draftMinStock, setDraftMinStock] = useState<Record<number, string>>({});
  const [savingGrocyProductId, setSavingGrocyProductId] = useState<number | null>(null);

  useEffect(() => {
    setDraftMinStock(
      Object.fromEntries(
        data.mappedProducts.map(product => [product.grocyProductId, String(product.minStockAmount)]),
      ),
    );
  }, [data]);

  const belowMinimumCount = useMemo(() =>
    data.mappedProducts.filter(product =>
      isBelowMinimumStock(product.currentStock, product.minStockAmount, product.isBelowMinimum),
    ).length,
    [data],
  );

  const filteredProducts = useMemo(() => {
    const query = productSearch.toLowerCase();
    return data.mappedProducts.filter(product =>
      (!showOnlyBelowMinimumStock || isBelowMinimumStock(
        product.currentStock,
        product.minStockAmount,
        product.isBelowMinimum,
      ))
      && (!productSearch
        || product.name.toLowerCase().includes(query)
        || product.unitName.toLowerCase().includes(query)),
    );
  }, [data, productSearch, showOnlyBelowMinimumStock]);

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

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={showOnlyBelowMinimumStock}
            onCheckedChange={(checked: boolean) => setShowOnlyBelowMinimumStock(checked)}
          />
          <span>Only currently below minimum ({belowMinimumCount})</span>
        </label>
        <Input
          placeholder="Filter mapped products by product or unit..."
          value={productSearch}
          onChange={event => setProductSearch(event.target.value)}
          className="max-w-[320px]"
        />
      </div>

      <div className="min-h-0 min-w-0 flex-1 rounded-md border">
        <Table className="min-w-[760px]" containerClassName="h-full min-w-0">
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="w-[140px]">Current Stock</TableHead>
              <TableHead className="w-[220px]">Min Stock</TableHead>
              <TableHead className="w-[110px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                  No mapped products match the current filters.
                </TableCell>
              </TableRow>
            )}
            {filteredProducts.map(product => {
              const draftValue = draftMinStock[product.grocyProductId] ?? String(product.minStockAmount);
              const parsedDraft = Number(draftValue);
              const isInvalid = !Number.isFinite(parsedDraft) || parsedDraft < 0;
              const isDirty = !isInvalid && parsedDraft !== product.minStockAmount;
              const isSaving = savingGrocyProductId === product.grocyProductId;

              return (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-muted-foreground">{product.unitName}</TableCell>
                  <TableCell>{formatAmount(product.currentStock)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        type="number"
                        min="0"
                        step={data.minStockStep}
                        value={draftValue}
                        onChange={event => {
                          const value = event.target.value;
                          setDraftMinStock(prev => ({ ...prev, [product.grocyProductId]: value }));
                        }}
                        onKeyDown={event => {
                          if (event.key === 'Enter' && isDirty && !isSaving) {
                            event.preventDefault();
                            void saveMinStock(product.grocyProductId);
                          }
                        }}
                        className="h-8 min-w-[11rem]"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void saveMinStock(product.grocyProductId)}
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
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => onUnmapProduct(product.id, product.name)}
                    >
                      Unmap
                    </Button>
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

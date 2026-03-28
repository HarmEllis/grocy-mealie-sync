import { listOpenMappingConflicts, type MappingConflictRecord } from '@/lib/mapping-conflicts-store';
import { getProductOverview, type ProductOverview } from '@/lib/use-cases/products/catalog';

export interface ExplainProductStateParams {
  productRef: string;
}

export interface ProductStateConflictSummary {
  id: string;
  summary: string;
  severity: string;
}

export interface ProductStateExplanation {
  productRef: string;
  summary: string;
  mappingStatus: 'mapped' | 'unmapped';
  stockStatus: {
    currentStock: number;
    minStockAmount: number;
    isBelowMinimum: boolean;
    treatOpenedAsOutOfStock: boolean;
  } | null;
  openConflicts: ProductStateConflictSummary[];
  notes: string[];
}

export interface DiagnosticsDeps {
  getProductOverview(params: ExplainProductStateParams): Promise<ProductOverview>;
  listOpenMappingConflicts(): Promise<MappingConflictRecord[]>;
}

const defaultDeps: DiagnosticsDeps = {
  getProductOverview,
  listOpenMappingConflicts,
};

function toConflictSummaries(
  overview: ProductOverview,
  conflicts: MappingConflictRecord[],
): ProductStateConflictSummary[] {
  if (!overview.mapping) {
    return [];
  }

  return conflicts
    .filter(conflict => conflict.mappingKind === 'product' && conflict.mappingId === overview.mapping?.id)
    .map(conflict => ({
      id: conflict.id,
      summary: conflict.summary,
      severity: conflict.severity,
    }));
}

export async function explainProductState(
  params: ExplainProductStateParams,
  deps: DiagnosticsDeps = defaultDeps,
): Promise<ProductStateExplanation> {
  const overview = await deps.getProductOverview({ productRef: params.productRef });
  const conflicts = toConflictSummaries(overview, await deps.listOpenMappingConflicts());

  if (!overview.mapping) {
    return {
      productRef: params.productRef,
      summary: 'This product is not mapped yet.',
      mappingStatus: 'unmapped',
      stockStatus: null,
      openConflicts: [],
      notes: [
        'No product mapping exists for this reference yet.',
      ],
    };
  }

  const grocyProduct = overview.grocyProduct;
  const stockStatus = grocyProduct ? {
    currentStock: grocyProduct.currentStock,
    minStockAmount: grocyProduct.minStockAmount,
    isBelowMinimum: grocyProduct.isBelowMinimum,
    treatOpenedAsOutOfStock: grocyProduct.treatOpenedAsOutOfStock,
  } : null;

  const notes: string[] = [];
  if (grocyProduct?.isBelowMinimum) {
    notes.push('Grocy currently reports this product below minimum stock.');
  }
  if (grocyProduct?.treatOpenedAsOutOfStock) {
    notes.push('Opened stock is configured to count as out of stock in Grocy.');
  }

  const conflictSuffix = conflicts.length === 0
    ? 'and has no open mapping conflicts.'
    : `and has ${conflicts.length} open mapping conflict${conflicts.length === 1 ? '' : 's'}.`;

  const stockClause = grocyProduct?.isBelowMinimum
    ? 'currently below minimum stock in Grocy'
    : 'currently not below minimum stock in Grocy';

  return {
    productRef: params.productRef,
    summary: `The product is mapped, ${stockClause}, ${conflictSuffix}`,
    mappingStatus: 'mapped',
    stockStatus,
    openConflicts: conflicts,
    notes,
  };
}

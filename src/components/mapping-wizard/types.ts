import type { MinStockStep } from '@/lib/min-stock-step';

export interface MealieFood { id: string; name: string }
export interface MealieUnit { id: string; name: string; abbreviation: string }
export interface GrocyProduct { id: number; name: string; quIdPurchase: number; minStockAmount: number }
export interface GrocyUnit { id: number; name: string }
export interface GrocyMinStockProduct {
  id: number;
  name: string;
  quIdPurchase: number;
  minStockAmount: number;
  currentStock: number;
  isBelowMinimum: boolean;
}
export interface UnitMappingRef {
  id: string;
  mealieUnitId: string;
  mealieUnitName: string;
  mealieUnitAbbreviation: string;
  grocyUnitId: number;
  grocyUnitName: string;
}
export interface SuggestionRunnerUp<TId extends string | number = number> {
  id: TId;
  name: string;
  score: number;
}
export interface ProductSuggestion {
  grocyProductId: number;
  grocyProductName: string;
  score: number;
  suggestedUnitId: number | null;
  ambiguous: boolean;
  runnerUp: SuggestionRunnerUp<number> | null;
}
export interface ReverseProductSuggestion {
  mealieFoodId: string;
  mealieFoodName: string;
  score: number;
  ambiguous: boolean;
  runnerUp: SuggestionRunnerUp<string> | null;
}
export interface UnitSuggestion {
  grocyUnitId: number;
  grocyUnitName: string;
  score: number;
  ambiguous: boolean;
  runnerUp: SuggestionRunnerUp<number> | null;
}

export interface WizardData {
  unmappedMealieFoods: MealieFood[];
  mealieUnits: MealieUnit[];
  unmappedMealieUnits: MealieUnit[];
  unmappedGrocyMinStockProducts: GrocyMinStockProduct[];
  grocyProducts: GrocyProduct[];
  grocyUnits: GrocyUnit[];
  existingUnitMappings: UnitMappingRef[];
  productSuggestions: Record<string, ProductSuggestion>;
  lowStockGrocyProductSuggestions: Record<string, ReverseProductSuggestion>;
  unitSuggestions: Record<string, UnitSuggestion>;
  orphanGrocyProductCount: number;
  orphanGrocyUnitCount: number;
}

export type UnitsTabData = Pick<
  WizardData,
  'mealieUnits' | 'unmappedMealieUnits' | 'grocyUnits' | 'existingUnitMappings' | 'unitSuggestions' | 'orphanGrocyUnitCount'
>;

export type ProductsTabData = Pick<
  WizardData,
  | 'unmappedMealieFoods'
  | 'grocyProducts'
  | 'grocyUnits'
  | 'existingUnitMappings'
  | 'productSuggestions'
  | 'orphanGrocyProductCount'
>;

export type GrocyMinStockTabData = Pick<
  WizardData,
  'unmappedGrocyMinStockProducts' | 'grocyUnits' | 'unmappedMealieFoods' | 'lowStockGrocyProductSuggestions'
> & {
  minStockStep: MinStockStep;
};

export interface MappedProductRow {
  id: string;
  grocyProductId: number;
  name: string;
  unitName: string;
  currentStock: number;
  minStockAmount: number;
  isBelowMinimum: boolean;
}

export interface MappedProductsTabData {
  mappedProducts: MappedProductRow[];
  minStockStep: MinStockStep;
}

export interface MappingConflictRow {
  id: string;
  conflictKey: string;
  type: string;
  status: string;
  severity: string;
  mappingKind: 'product' | 'unit';
  mappingId: string;
  sourceTab: 'products' | 'units';
  mealieId: string | null;
  mealieName: string | null;
  grocyId: number | null;
  grocyName: string | null;
  summary: string;
  occurrences: number;
  firstSeenAt: string | Date;
  lastSeenAt: string | Date;
  resolvedAt: string | Date | null;
}

export interface ConflictsTabData {
  conflicts: MappingConflictRow[];
}

export interface ProductConflictRemapData {
  mappingKind: 'product';
  currentSelection: {
    mealieFoodId: string | null;
    grocyProductId: number | null;
    grocyUnitId: number | null;
  };
  mealieFoods: MealieFood[];
  grocyProducts: GrocyProduct[];
  grocyUnits: GrocyUnit[];
}

export interface UnitConflictRemapData {
  mappingKind: 'unit';
  currentSelection: {
    mealieUnitId: string | null;
    grocyUnitId: number | null;
  };
  mealieUnits: MealieUnit[];
  grocyUnits: GrocyUnit[];
}

export type ConflictRemapData = ProductConflictRemapData | UnitConflictRemapData;

export interface ProductMapping { mealieFoodId: string; grocyProductId: number | null; grocyUnitId: number | null }
export interface GrocyMinStockProductMapping { grocyProductId: number; mealieFoodId: string | null; grocyUnitId: number | null }
export interface UnitMapping { mealieUnitId: string; grocyUnitId: number | null }

export interface SelectOption<T extends string | number = number> { value: T; label: string }

export const sortByName = <T extends { name: string }>(items: T[]) =>
  [...items].sort((a, b) => a.name.localeCompare(b.name));

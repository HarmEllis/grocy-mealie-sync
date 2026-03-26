export interface MealieFood { id: string; name: string }
export interface MealieUnit { id: string; name: string; abbreviation: string }
export interface GrocyProduct { id: number; name: string; quIdPurchase: number; minStockAmount: number }
export interface GrocyUnit { id: number; name: string }
export interface GrocyMinStockProduct { id: number; name: string; quIdPurchase: number; minStockAmount: number }
export interface UnitMappingRef { id: string; grocyUnitId: number; grocyUnitName: string; mealieUnitName: string }
export interface ProductSuggestion { grocyProductId: number; grocyProductName: string; score: number; suggestedUnitId: number | null }
export interface ReverseProductSuggestion { mealieFoodId: string; mealieFoodName: string; score: number }
export interface UnitSuggestion { grocyUnitId: number; grocyUnitName: string; score: number }

export interface WizardData {
  unmappedMealieFoods: MealieFood[];
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

export interface ProductMapping { mealieFoodId: string; grocyProductId: number | null; grocyUnitId: number | null }
export interface GrocyMinStockProductMapping { grocyProductId: number; mealieFoodId: string | null; grocyUnitId: number | null }
export interface UnitMapping { mealieUnitId: string; grocyUnitId: number | null }

export interface SelectOption<T extends string | number = number> { value: T; label: string }

export const sortByName = <T extends { name: string }>(items: T[]) =>
  [...items].sort((a, b) => a.name.localeCompare(b.name));

export interface MealieFood { id: string; name: string }
export interface MealieUnit { id: string; name: string; abbreviation: string }
export interface GrocyProduct { id: number; name: string; quIdPurchase: number }
export interface GrocyUnit { id: number; name: string }
export interface UnitMappingRef { id: string; grocyUnitId: number; grocyUnitName: string; mealieUnitName: string }
export interface ProductSuggestion { grocyProductId: number; grocyProductName: string; score: number; suggestedUnitId: number | null }
export interface UnitSuggestion { grocyUnitId: number; grocyUnitName: string; score: number }

export interface WizardData {
  unmappedMealieFoods: MealieFood[];
  unmappedMealieUnits: MealieUnit[];
  grocyProducts: GrocyProduct[];
  grocyUnits: GrocyUnit[];
  existingUnitMappings: UnitMappingRef[];
  productSuggestions: Record<string, ProductSuggestion>;
  unitSuggestions: Record<string, UnitSuggestion>;
  orphanGrocyProductCount: number;
  orphanGrocyUnitCount: number;
}

export interface ProductMapping { mealieFoodId: string; grocyProductId: number | null; grocyUnitId: number | null }
export interface UnitMapping { mealieUnitId: string; grocyUnitId: number | null }

export interface SelectOption { value: number; label: string }

export const sortByName = <T extends { name: string }>(items: T[]) =>
  [...items].sort((a, b) => a.name.localeCompare(b.name));

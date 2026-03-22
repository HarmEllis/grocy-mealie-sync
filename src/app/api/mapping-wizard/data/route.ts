import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productMappings, unitMappings } from '@/lib/db/schema';
import { GenericEntityInteractionsService } from '@/lib/grocy';
import { RecipesFoodsService, RecipesUnitsService } from '@/lib/mealie';
import { fuzzyMatch } from '@/lib/fuzzy-match';
import { log } from '@/lib/logger';

export async function GET() {
  try {
    // Fetch all data in parallel
    const [mealieFoodsRes, mealieUnitsRes, grocyProductsRaw, grocyUnitsRaw, existingProductMappings, existingUnitMappings] =
      await Promise.all([
        RecipesFoodsService.getAllApiFoodsGet(
          undefined, undefined, undefined, undefined, undefined, undefined, 1, 10000,
        ),
        RecipesUnitsService.getAllApiUnitsGet(
          undefined, undefined, undefined, undefined, undefined, undefined, 1, 1000,
        ),
        GenericEntityInteractionsService.getObjects('products' as any),
        GenericEntityInteractionsService.getObjects('quantity_units' as any),
        db.select().from(productMappings),
        db.select().from(unitMappings),
      ]);

    const mealieFoods: any[] = (mealieFoodsRes as any).items || [];
    const mealieUnits: any[] = (mealieUnitsRes as any).items || [];
    const grocyProducts: any[] = Array.isArray(grocyProductsRaw) ? grocyProductsRaw : [];
    const grocyUnits: any[] = Array.isArray(grocyUnitsRaw) ? grocyUnitsRaw : [];

    // Find unmapped Mealie foods
    const mappedMealieFoodIds = new Set(existingProductMappings.map(m => m.mealieFoodId));
    const unmappedMealieFoods = mealieFoods
      .filter(f => f.id && !mappedMealieFoodIds.has(f.id))
      .map(f => ({ id: f.id, name: f.name || 'Unknown' }));

    // Find unmapped Mealie units
    const mappedMealieUnitIds = new Set(existingUnitMappings.map(m => m.mealieUnitId));
    const unmappedMealieUnits = mealieUnits
      .filter(u => u.id && !mappedMealieUnitIds.has(u.id))
      .map(u => ({ id: u.id, name: u.name || 'Unknown', abbreviation: u.abbreviation || '' }));

    // Grocy products/units for dropdowns
    const grocyProductList = grocyProducts.map((p: any) => ({
      id: Number(p.id),
      name: p.name || 'Unknown',
      quIdPurchase: Number(p.qu_id_purchase || 0),
    }));

    const grocyUnitList = grocyUnits.map((u: any) => ({
      id: Number(u.id),
      name: u.name || 'Unknown',
    }));

    // Compute fuzzy suggestions for products
    const mappedGrocyProductIds = new Set(existingProductMappings.map(m => m.grocyProductId));
    const availableGrocyProducts = grocyProductList.filter(p => !mappedGrocyProductIds.has(p.id));

    const productSuggestions: Record<string, { grocyProductId: number; grocyProductName: string; score: number; suggestedUnitId: number | null }> = {};
    for (const mFood of unmappedMealieFoods) {
      const matches = fuzzyMatch(mFood.name, availableGrocyProducts, p => p.name, 0.3, 1);
      if (matches.length > 0) {
        const best = matches[0];
        // Try to find unit mapping for this Grocy product's purchase unit
        const grocyUnitId = best.item.quIdPurchase;
        let suggestedUnitId: number | null = null;
        if (grocyUnitId) {
          const unitMapping = existingUnitMappings.find(um => um.grocyUnitId === grocyUnitId);
          if (unitMapping) suggestedUnitId = grocyUnitId;
        }
        productSuggestions[mFood.id] = {
          grocyProductId: best.item.id,
          grocyProductName: best.item.name,
          score: Math.round(best.score * 100),
          suggestedUnitId,
        };
      }
    }

    // Compute fuzzy suggestions for units
    const mappedGrocyUnitIds = new Set(existingUnitMappings.map(m => m.grocyUnitId));
    const availableGrocyUnits = grocyUnitList.filter(u => !mappedGrocyUnitIds.has(u.id));

    const unitSuggestions: Record<string, { grocyUnitId: number; grocyUnitName: string; score: number }> = {};
    for (const mUnit of unmappedMealieUnits) {
      // Match by name or abbreviation
      const nameMatches = fuzzyMatch(mUnit.name, availableGrocyUnits, u => u.name, 0.3, 1);
      const abbrMatches = mUnit.abbreviation
        ? fuzzyMatch(mUnit.abbreviation, availableGrocyUnits, u => u.name, 0.4, 1)
        : [];
      const best = [...nameMatches, ...abbrMatches].sort((a, b) => b.score - a.score)[0];
      if (best) {
        unitSuggestions[mUnit.id] = {
          grocyUnitId: best.item.id,
          grocyUnitName: best.item.name,
          score: Math.round(best.score * 100),
        };
      }
    }

    // Orphan counts: Grocy items without a Mealie counterpart
    const mealieFoodNames = new Set(mealieFoods.map((f: any) => (f.name || '').toLowerCase()));
    const mealieUnitNames = new Set(mealieUnits.flatMap((u: any) => [
      (u.name || '').toLowerCase(),
      (u.abbreviation || '').toLowerCase(),
    ].filter(Boolean)));

    const orphanGrocyProducts = grocyProductList.filter(p =>
      !mappedGrocyProductIds.has(p.id) && !mealieFoodNames.has(p.name.toLowerCase()),
    );
    const orphanGrocyUnits = grocyUnitList.filter(u =>
      !mappedGrocyUnitIds.has(u.id) && !mealieUnitNames.has(u.name.toLowerCase()),
    );

    return NextResponse.json({
      unmappedMealieFoods,
      unmappedMealieUnits,
      grocyProducts: grocyProductList,
      grocyUnits: grocyUnitList,
      existingUnitMappings: existingUnitMappings.map(m => ({
        id: m.id,
        grocyUnitId: m.grocyUnitId,
        grocyUnitName: m.grocyUnitName,
        mealieUnitName: m.mealieUnitName,
      })),
      productSuggestions,
      unitSuggestions,
      orphanGrocyProductCount: orphanGrocyProducts.length,
      orphanGrocyUnitCount: orphanGrocyUnits.length,
    });
  } catch (error) {
    log.error('[MappingWizard] Failed to fetch data:', error);
    return NextResponse.json({ error: 'Failed to fetch mapping data' }, { status: 500 });
  }
}

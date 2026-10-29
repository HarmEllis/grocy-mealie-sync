import { ShopApiError } from './api-helpers';
import { refreshCatalogProducts } from './catalog-service';
import { saveRetailerMapping } from './mapping-save';
import { getRetailerMapping, getSuggestion, listRetailerMappings, listSuggestions } from './retailer-catalog';

export const DEFAULT_BULK_MIN_SCORE = 0.85;
const MAX_BULK = 100;

export interface BulkAcceptResult {
  accepted: Array<{ id: string; providerId: string; retailerProductId: string; targetName: string }>;
  skipped: Array<{ id: string; providerId: string; retailerProductId: string; reason: string }>;
}

/** Another retailer product that is already the preferred one for this target at this retailer. */
function preferredElsewhere(suggestion: { providerId: string; retailerProductId: string; targetKind: string; targetId: string }) {
  return listRetailerMappings(suggestion.providerId).find(mapping => mapping.role === 'preferred'
    && mapping.retailerProductId !== suggestion.retailerProductId && mapping.targetKind === suggestion.targetKind && mapping.targetId === suggestion.targetId);
}
const PREFERRED_TAKEN = 'This product already has a preferred retailer product at this retailer; review it in Products instead.';

/**
 * Accept every pending suggestion whose displayed score (rounded percent) is above the threshold.
 * Mappings are saved exactly like a single accept without confirming an amount, so they stay
 * unconfirmed and show up as needing attention until the package amount is checked. A suggestion that
 * conflicts (its target was linked to a Grocy product, the retailer product is mapped elsewhere, a
 * Grocy unit vanished) is skipped with its reason; it never aborts the batch. A target that already has a
 * preferred product at the retailer (confirmed, or saved earlier in this batch from a higher score) is never
 * displaced: saving would demote that mapping to an alternative.
 */
export async function acceptSuggestionsBulk(options: { minScore?: number } = {}): Promise<BulkAcceptResult> {
  const threshold = Math.round((options.minScore ?? DEFAULT_BULK_MIN_SCORE) * 100);
  const candidates = listSuggestions()
    .filter(suggestion => Math.round(suggestion.score * 100) > threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_BULK);

  // One catalogue refresh per provider so each save finds fresh availability instead of calling the plugin again.
  const idsByProvider = new Map<string, string[]>();
  for (const suggestion of candidates) idsByProvider.set(suggestion.providerId, [...(idsByProvider.get(suggestion.providerId) ?? []), suggestion.retailerProductId]);
  for (const [providerId, ids] of idsByProvider) {
    try { await refreshCatalogProducts(providerId, ids); } catch { /* offline plugins fall back to the per-save check */ }
  }

  const result: BulkAcceptResult = { accepted: [], skipped: [] };
  for (const suggestion of candidates) {
    const ref = { id: suggestion.id, providerId: suggestion.providerId, retailerProductId: suggestion.retailerProductId };
    try {
      if (getSuggestion(suggestion.id)?.status !== 'pending') throw new ShopApiError(409, 'Suggestion was already decided');
      const existing = getRetailerMapping(suggestion.providerId, suggestion.retailerProductId);
      if (existing?.role !== 'alternative' && preferredElsewhere(suggestion)) throw new ShopApiError(409, PREFERRED_TAKEN);
      await saveRetailerMapping({
        providerId: suggestion.providerId,
        retailerProductId: suggestion.retailerProductId,
        targetKind: suggestion.targetKind as 'grocy_product' | 'mealie_food',
        targetId: suggestion.targetId,
        targetName: suggestion.targetName,
        role: existing?.role === 'alternative' ? 'alternative' : 'preferred',
        baseUnitId: null,
        baseUnitName: null,
        confirm: false,
        reassign: false,
      }, {
        beforeWrite: () => {
          if (getSuggestion(suggestion.id)?.status !== 'pending') throw new ShopApiError(409, 'Suggestion was already decided while its target was being resolved');
          if (existing?.role !== 'alternative' && preferredElsewhere(suggestion)) throw new ShopApiError(409, PREFERRED_TAKEN);
        },
      });
      result.accepted.push({ ...ref, targetName: suggestion.targetName });
    } catch (error) {
      result.skipped.push({ ...ref, reason: error instanceof ShopApiError ? error.message : 'Unexpected error while saving the mapping' });
    }
  }
  return result;
}

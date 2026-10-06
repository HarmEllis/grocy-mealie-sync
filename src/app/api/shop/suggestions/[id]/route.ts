import { z } from 'zod';
import { getRetailerMapping, getSuggestion, rejectSuggestion, upsertRetailerMapping } from '@/lib/shop/retailer-catalog';
import { readJson, ShopApiError, shopRoute } from '@/lib/shop/api-helpers';
import { resolveGrocyMappingTarget } from '@/lib/shop/targets';

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('accept'),
    baseUnitId: z.string().max(128).nullable().default(null),
    baseUnitName: z.string().max(100).nullable().default(null),
    packageBaseAmount: z.number().positive().finite().nullable().optional(),
    confirm: z.boolean().default(false),
  }).strict(),
  z.object({ action: z.literal('reject') }).strict(),
]);

/** Decide a suggestion once; decided pairs are never suggested again. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return shopRoute('Decide suggestion', async () => {
    const { id } = await context.params;
    const body = bodySchema.parse(await readJson(request));
    const suggestion = getSuggestion(id);
    if (!suggestion || suggestion.status !== 'pending') throw new ShopApiError(404, 'Suggestion not found or already decided');
    if (body.action === 'reject') {
      rejectSuggestion(id);
      return { ok: true };
    }
    const existing = getRetailerMapping(suggestion.providerId, suggestion.retailerProductId);
    const target = suggestion.targetKind === 'grocy_product'
      ? await resolveGrocyMappingTarget(suggestion.targetId)
      : null;
    if (suggestion.targetKind === 'grocy_product' && !target) {
      throw new ShopApiError(409, 'The suggested Grocy product or its stock unit is no longer available');
    }
    if (getSuggestion(id)?.status !== 'pending') {
      throw new ShopApiError(409, 'Suggestion was already decided while its target was being resolved');
    }
    const mapping = upsertRetailerMapping({
      providerId: suggestion.providerId,
      retailerProductId: suggestion.retailerProductId,
      targetKind: suggestion.targetKind as 'grocy_product' | 'mealie_food',
      targetId: suggestion.targetId,
      targetName: target?.name ?? suggestion.targetName,
      role: existing?.role === 'alternative' ? 'alternative' : 'preferred',
      baseUnitId: target?.baseUnitId ?? body.baseUnitId,
      baseUnitName: target ? target.baseUnitName : body.baseUnitName,
      packageBaseAmount: body.packageBaseAmount,
      confirm: body.confirm,
    });
    return { mapping };
  });
}

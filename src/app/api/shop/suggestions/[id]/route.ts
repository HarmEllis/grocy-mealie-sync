import { z } from 'zod';
import { getRetailerMapping, getSuggestion, rejectSuggestion, upsertRetailerMapping } from '@/lib/shop/retailer-catalog';
import { readJson, ShopApiError, shopRoute } from '@/lib/shop/api-helpers';

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
    const mapping = upsertRetailerMapping({
      providerId: suggestion.providerId,
      retailerProductId: suggestion.retailerProductId,
      targetKind: suggestion.targetKind as 'grocy_product' | 'mealie_food',
      targetId: suggestion.targetId,
      targetName: suggestion.targetName,
      role: existing?.role === 'alternative' ? 'alternative' : 'preferred',
      baseUnitId: body.baseUnitId,
      baseUnitName: body.baseUnitName,
      packageBaseAmount: body.packageBaseAmount,
      confirm: body.confirm,
    });
    return { mapping };
  });
}

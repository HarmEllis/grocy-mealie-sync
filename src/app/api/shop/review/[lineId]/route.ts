import { z } from 'zod';
import { resolveShoppingListId } from '@/lib/settings';
import { fetchAllMealieShoppingItems } from '@/lib/sync/helpers';
import { getGrocyEntities } from '@/lib/grocy/types';
import { dismissReceiptLine, requeueReceiptLine, substituteReceiptLine } from '@/lib/shop/discrepancies';
import { readJson, ShopApiError, shopRoute, withSyncLock } from '@/lib/shop/api-helpers';

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('substitute'),
    bookGrocyProductId: z.number().int().positive().nullable(),
    bookGrocyProductName: z.string().max(200).optional(),
    stockAmount: z.number().positive().finite().nullable(),
    mealieItemIds: z.array(z.string().min(1).max(64)).max(50).default([]),
    lifecycleIds: z.array(z.string().min(1).max(64)).max(50).default([]),
    rememberAsAlternative: z.boolean().default(false),
  }).strict(),
  z.object({ action: z.literal('dismiss') }).strict(),
  z.object({ action: z.literal('requeue') }).strict(),
]);

/** Resolve a receipt line under review: one-off substitution, dismissal, or re-plan after mapping. */
export async function POST(request: Request, context: { params: Promise<{ lineId: string }> }) {
  return shopRoute('Resolve receipt line', async () => {
    const { lineId } = await context.params;
    const body = bodySchema.parse(await readJson(request));
    return withSyncLock(async () => {
      if (body.action === 'dismiss') {
        if (!dismissReceiptLine(lineId)) throw new ShopApiError(404, 'Line is not under review');
        return { ok: true };
      }
      if (body.action === 'requeue') {
        if (!requeueReceiptLine(lineId)) throw new ShopApiError(404, 'Line is not under review');
        return { ok: true };
      }
      const shoppingListId = await resolveShoppingListId();
      if (!shoppingListId) throw new ShopApiError(400, 'No Mealie shopping list configured');
      const items = body.mealieItemIds.length > 0 ? await fetchAllMealieShoppingItems(shoppingListId) : [];
      let bookBaseUnit: { id: string; name: string | null } | null = null;
      if (body.rememberAsAlternative && body.bookGrocyProductId !== null) {
        // The remembered amount is only valid in the product's current stock unit.
        const [products, units] = await Promise.all([getGrocyEntities('products'), getGrocyEntities('quantity_units')]);
        const product = products.find(candidate => Number(candidate.id) === body.bookGrocyProductId);
        if (product?.qu_id_stock) {
          bookBaseUnit = {
            id: String(product.qu_id_stock),
            name: units.find(unit => Number(unit.id) === Number(product.qu_id_stock))?.name ?? null,
          };
        }
      }
      const result = substituteReceiptLine({ ...body, receiptLineId: lineId, shoppingListId, bookBaseUnit }, items);
      if (!result.ok) throw new ShopApiError(409, result.message ?? 'Substitution failed');
      return result;
    });
  });
}

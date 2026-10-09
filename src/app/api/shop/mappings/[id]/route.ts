import { z } from 'zod';
import { deleteRetailerMapping } from '@/lib/shop/retailer-catalog';
import { updateRetailerMapping } from '@/lib/shop/mapping-save';
import { readJson, ShopApiError, shopRoute } from '@/lib/shop/api-helpers';

const patchSchema = z.object({
  packageBaseAmount: z.number().positive().finite().optional(),
  role: z.enum(['preferred', 'alternative']).optional(),
}).strict();

type Context = { params: Promise<{ id: string }> };

/** Confirm the package amount (required before automatic processing) or change the role. */
export async function PATCH(request: Request, context: Context) {
  return shopRoute('Update shop mapping', async () => {
    const { id } = await context.params;
    const body = patchSchema.parse(await readJson(request));
    return updateRetailerMapping(id, body);
  });
}

export async function DELETE(_request: Request, context: Context) {
  return shopRoute('Delete shop mapping', async () => {
    const { id } = await context.params;
    if (!deleteRetailerMapping(id)) throw new ShopApiError(404, 'Mapping not found');
    return { ok: true };
  });
}

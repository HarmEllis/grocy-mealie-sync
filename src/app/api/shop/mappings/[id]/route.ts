import { z } from 'zod';
import { confirmRetailerMapping, deleteRetailerMapping, getRetailerMappingById, setRetailerMappingRole } from '@/lib/shop/retailer-catalog';
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
    if (!getRetailerMappingById(id)) throw new ShopApiError(404, 'Mapping not found');
    if (body.role) setRetailerMappingRole(id, body.role);
    if (body.packageBaseAmount !== undefined) confirmRetailerMapping(id, body.packageBaseAmount);
    return { mapping: getRetailerMappingById(id) };
  });
}

export async function DELETE(_request: Request, context: Context) {
  return shopRoute('Delete shop mapping', async () => {
    const { id } = await context.params;
    if (!deleteRetailerMapping(id)) throw new ShopApiError(404, 'Mapping not found');
    return { ok: true };
  });
}

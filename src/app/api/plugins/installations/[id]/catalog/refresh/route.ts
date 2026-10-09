import { z } from 'zod';
import { getInstallation } from '@/lib/plugins/installations';
import { readJson, ShopApiError, shopRoute } from '@/lib/shop/api-helpers';
import { refreshCatalogProducts } from '@/lib/shop/catalog-service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ ids: z.array(z.string().min(1).max(128)).min(1).max(200) }).strict();

/**
 * Re-read stored products with `catalog.get` to update package data and
 * availability. Products the plugin does not return keep their stored values.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return shopRoute('Catalogue refresh', async () => {
    const { id } = await context.params;
    const { ids } = bodySchema.parse(await readJson(request));
    const installation = getInstallation(id);
    if (!installation?.providerId) throw new ShopApiError(404, 'Installation not found or never connected');
    return refreshCatalogProducts(installation.providerId, ids, { installationId: id });
  });
}

import { z } from 'zod';
import { getInstallation } from '@/lib/plugins/installations';
import { getPluginGateway } from '@/lib/plugins/runtime';
import { ShopApiError, shopRoute } from '@/lib/shop/api-helpers';
import { upsertRetailerProducts } from '@/lib/shop/retailer-catalog';

/** Search the retailer catalogue through the plugin; results are remembered for mapping. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return shopRoute('Catalogue search', async () => {
    const { id } = await context.params;
    const query = z.string().trim().min(1).max(200).parse(new URL(request.url).searchParams.get('query') ?? '');
    const installation = getInstallation(id);
    if (!installation?.providerId) throw new ShopApiError(404, 'Installation not found or never connected');
    const gateway = getPluginGateway();
    if (!gateway?.getSession(id)) throw new ShopApiError(503, 'The plugin is not connected');
    const result = await gateway.call(id, 'catalog.search', { query });
    upsertRetailerProducts(installation.providerId, result.products);
    return { providerId: installation.providerId, products: result.products };
  });
}

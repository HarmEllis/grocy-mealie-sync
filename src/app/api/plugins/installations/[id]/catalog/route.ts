import { z } from 'zod';
import { getInstallation } from '@/lib/plugins/installations';
import { ShopApiError, shopRoute } from '@/lib/shop/api-helpers';
import { searchCatalog } from '@/lib/shop/catalog-service';

export const dynamic = 'force-dynamic';

/**
 * Search the retailer catalogue through the plugin. Live results are remembered
 * for mapping and briefly cached; stored products matching the query follow
 * them. When the plugin is unavailable the stored matches are returned with
 * `status: "offline"`. `refresh=1` bypasses the short cache.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return shopRoute('Catalogue search', async () => {
    const { id } = await context.params;
    const searchParams = new URL(request.url).searchParams;
    const query = z.string().trim().min(1).max(200).parse(searchParams.get('query') ?? '');
    const refresh = ['1', 'true'].includes(searchParams.get('refresh') ?? '');
    if (!getInstallation(id)?.providerId) throw new ShopApiError(404, 'Installation not found or never connected');
    const result = await searchCatalog(id, query, { refresh });
    if (!result) throw new ShopApiError(404, 'Installation not found or never connected');
    return result;
  });
}

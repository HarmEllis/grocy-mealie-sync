import { retryCatalogSearch } from '@/lib/shop/catalog-discovery';
import { shopRoute, ShopApiError } from '@/lib/shop/api-helpers';
import { getShopWorker } from '@/lib/plugins/runtime';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return shopRoute('Retry catalogue search', async () => {
    const { id } = await context.params;
    if (!retryCatalogSearch(id)) throw new ShopApiError(404, 'Active catalogue search not found');
    getShopWorker()?.requestListSync();
    return { ok: true };
  });
}

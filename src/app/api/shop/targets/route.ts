import { z } from 'zod';
import { shopRoute } from '@/lib/shop/api-helpers';
import { searchMappingTargets } from '@/lib/shop/targets';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return shopRoute('Mapping target search', async () => {
    const query = z.string().trim().max(200).parse(new URL(request.url).searchParams.get('query') ?? '');
    return searchMappingTargets(query);
  });
}

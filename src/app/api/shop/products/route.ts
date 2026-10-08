import { z } from 'zod';
import { shopRoute } from '@/lib/shop/api-helpers';
import { productInventory } from '@/lib/shop/product-inventory';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return shopRoute('Own product mapping overview', async () => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const input = z.object({
      refresh: z.enum(['true', 'false', '1', '0']).optional().transform(value => value === 'true' || value === '1'),
      query: z.string().trim().max(200).optional(),
      source: z.enum(['all', 'grocy_mealie', 'grocy', 'mealie']).default('all'),
      mapped: z.enum(['all', 'mapped', 'unmapped']).default('all'),
      providerId: z.string().min(1).max(40).optional(),
      offset: z.coerce.number().int().min(0).default(0),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }).strict().parse(params);
    return productInventory(input, true);
  });
}

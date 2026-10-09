import { shopOverview } from '@/lib/shop/overview';
import { shopRoute } from '@/lib/shop/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  return shopRoute('Shop overview', () => shopOverview());
}

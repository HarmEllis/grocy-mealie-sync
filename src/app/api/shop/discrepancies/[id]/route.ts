import { z } from 'zod';
import { resolveDiscrepancy } from '@/lib/shop/discrepancies';
import { readJson, shopRoute, withSyncLock } from '@/lib/shop/api-helpers';

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('undo_transaction'), transactionId: z.string().min(1).max(64) }).strict(),
  z.object({ action: z.literal('consume_difference'), productId: z.number().int().positive(), amount: z.number().positive().finite() }).strict(),
  z.object({ action: z.literal('keep_stock') }).strict(),
  z.object({ action: z.literal('book_check') }).strict(),
  z.object({ action: z.literal('skip_check') }).strict(),
]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return shopRoute('Resolve discrepancy', async () => {
    const { id } = await context.params;
    const body = bodySchema.parse(await readJson(request));
    return withSyncLock(() => resolveDiscrepancy(id, body));
  });
}

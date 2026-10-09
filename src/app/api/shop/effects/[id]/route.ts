import { z } from 'zod';
import { resolveUnknownEffect } from '@/lib/shop/effect-resolution';
import { readJson, ShopApiError, shopRoute, withSyncLock } from '@/lib/shop/api-helpers';

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('booked_elsewhere'), transactionId: z.string().max(64).optional(), note: z.string().max(500).optional() }).strict(),
  z.object({ action: z.literal('not_booked_retry') }).strict(),
  z.object({ action: z.literal('skip') }).strict(),
]);

/** The user's decision for a write whose outcome is unknown. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return shopRoute('Resolve uncertain write', async () => {
    const { id } = await context.params;
    const body = bodySchema.parse(await readJson(request));
    const changed = await withSyncLock(() => resolveUnknownEffect(id, body));
    if (!changed) throw new ShopApiError(409, 'The write is no longer waiting for a decision');
    return { ok: true };
  });
}

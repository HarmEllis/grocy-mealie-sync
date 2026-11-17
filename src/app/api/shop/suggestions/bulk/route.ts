import { z } from 'zod';
import { readJson, shopRoute } from '@/lib/shop/api-helpers';
import { acceptSuggestionsBulk, DEFAULT_BULK_MIN_SCORE } from '@/lib/shop/suggestion-bulk';

const bodySchema = z.object({
  /** Accept suggestions whose displayed score is above this fraction (0.85 = 85%). */
  minScore: z.number().min(0).max(1).default(DEFAULT_BULK_MIN_SCORE),
}).strict();

/** Accept many confident suggestions at once; conflicts are skipped and reported, never fatal. */
export async function POST(request: Request) {
  return shopRoute('Accept suggestions in bulk', async () => {
    const body = bodySchema.parse(await readJson(request));
    return acceptSuggestionsBulk({ minScore: body.minScore });
  });
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { productMappings } from '@/lib/db/schema';
import { log } from '@/lib/logger';
import { resolveConflictsForMapping } from '@/lib/mapping-conflicts-store';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';
import { buildManualHistoryEvent, createManualHistoryRecorder, formatManualActionError } from '@/lib/manual-action-history';

const productUnmapRequestSchema = z.object({
  id: z.string().min(1),
});

export async function POST(request: Request) {
  if (!acquireSyncLock()) {
    return NextResponse.json(
      { error: 'A sync operation is already in progress. Please try again.' },
      { status: 409 },
    );
  }

  const history = createManualHistoryRecorder(
    'mapping_product_unmap',
    '[History] Failed to record product unmap:',
  );

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = productUnmapRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const [existingMapping] = await db.select()
      .from(productMappings)
      .where(eq(productMappings.id, parsed.data.id))
      .limit(1);

    if (!existingMapping) {
      return NextResponse.json({ error: 'Product mapping not found' }, { status: 404 });
    }

    await db.delete(productMappings).where(eq(productMappings.id, parsed.data.id));
    await resolveConflictsForMapping('product', parsed.data.id);

    await history.recordSuccess({
      message: `Removed product mapping ${parsed.data.id}.`,
      summary: { id: parsed.data.id },
      events: [
        buildManualHistoryEvent({
          level: 'info',
          category: 'mapping',
          entityKind: 'product',
          entityRef: parsed.data.id,
          message: `Removed product mapping ${parsed.data.id}.`,
        }),
      ],
    });

    return NextResponse.json({
      status: 'ok',
      unmapped: true,
      id: parsed.data.id,
    });
  } catch (error) {
    await history.recordFailure({
      logMessage: '[MappingWizard] Product unmap failed:',
      error,
      message: `Product unmap failed: ${formatManualActionError(error)}`,
      summary: { error: formatManualActionError(error) },
      events: [
        buildManualHistoryEvent({
          level: 'error',
          category: 'mapping',
          entityKind: 'product',
          message: 'Product unmap failed.',
          details: { error: formatManualActionError(error) },
        }),
      ],
    });
    return NextResponse.json({ error: 'Failed to unmap product' }, { status: 500 });
  } finally {
    releaseSyncLock();
  }
}

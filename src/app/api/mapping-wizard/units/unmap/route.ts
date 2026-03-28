import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { unitMappings } from '@/lib/db/schema';
import { log } from '@/lib/logger';
import { resolveConflictsForMapping } from '@/lib/mapping-conflicts-store';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';
import { buildManualHistoryEvent, createManualHistoryRecorder, formatManualActionError } from '@/lib/manual-action-history';

const unitUnmapRequestSchema = z.object({
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
    'mapping_unit_unmap',
    '[History] Failed to record unit unmap:',
  );

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = unitUnmapRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const [existingMapping] = await db.select()
      .from(unitMappings)
      .where(eq(unitMappings.id, parsed.data.id))
      .limit(1);

    if (!existingMapping) {
      return NextResponse.json({ error: 'Unit mapping not found' }, { status: 404 });
    }

    await db.delete(unitMappings).where(eq(unitMappings.id, parsed.data.id));
    await resolveConflictsForMapping('unit', parsed.data.id);

    await history.record({
      status: 'success',
      message: `Removed unit mapping ${parsed.data.id}.`,
      summary: { id: parsed.data.id },
      events: [
        buildManualHistoryEvent({
          level: 'info',
          category: 'mapping',
          entityKind: 'unit',
          entityRef: parsed.data.id,
          message: `Removed unit mapping ${parsed.data.id}.`,
        }),
      ],
    });

    return NextResponse.json({
      status: 'ok',
      unmapped: true,
      id: parsed.data.id,
    });
  } catch (error) {
    log.error('[MappingWizard] Unit unmap failed:', error);
    await history.record({
      status: 'failure',
      message: `Unit unmap failed: ${formatManualActionError(error)}`,
      summary: { error: formatManualActionError(error) },
      events: [
        buildManualHistoryEvent({
          level: 'error',
          category: 'mapping',
          entityKind: 'unit',
          message: 'Unit unmap failed.',
          details: { error: formatManualActionError(error) },
        }),
      ],
    });
    return NextResponse.json({ error: 'Failed to unmap unit' }, { status: 500 });
  } finally {
    releaseSyncLock();
  }
}

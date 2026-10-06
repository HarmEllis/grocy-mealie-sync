import { z } from 'zod';
import { deleteUnitConversion } from '@/lib/use-cases/conversions/manage';
import { createManualHistoryRecorder, buildManualHistoryEvent } from '@/lib/manual-action-history';
import { conversionResponse } from '../helpers';

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  return conversionResponse(async () => {
    const conversionId = z.coerce.number().int().positive().parse((await context.params).id);
    const history = createManualHistoryRecorder('conversion_delete', '[Conversions] History failed:');
    const result = await deleteUnitConversion({ conversionId });
    await history.recordSuccess({ message: `Deleted unit conversion ${conversionId}.`, summary: result,
      events: [buildManualHistoryEvent({ level: 'info', category: 'mapping', entityKind: 'unit', entityRef: `conversion:${conversionId}`, message: `Deleted unit conversion ${conversionId} and its inverse.`, details: result })] });
    return result;
  });
}

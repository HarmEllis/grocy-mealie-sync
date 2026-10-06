import { z } from 'zod';
import { listConversions, createUnitConversion } from '@/lib/use-cases/conversions/manage';
import { getUnitCatalog } from '@/lib/use-cases/units/manage';
import { createManualHistoryRecorder, buildManualHistoryEvent } from '@/lib/manual-action-history';
import { conversionResponse } from './helpers';
import { getGrocyEntities } from '@/lib/grocy/types';

const createSchema = z.object({ fromGrocyUnitId: z.number().int().positive(), toGrocyUnitId: z.number().int().positive(), factor: z.number().positive(), grocyProductId: z.number().int().positive().nullable().optional() })
  .refine(p => p.fromGrocyUnitId !== p.toGrocyUnitId, { message: 'Choose two different units.' });

export async function GET(request: Request) {
  return conversionResponse(async () => {
    const target = z.enum(['both', 'grocy']).parse(new URL(request.url).searchParams.get('target') ?? 'both');
    const [conversions, units, products] = await Promise.all([listConversions(), getUnitCatalog(undefined, target), getGrocyEntities('products')]);
    return { ...conversions, units, products: products.map(p => ({ id: Number(p.id), name: p.name ?? `Product #${p.id}` })).sort((a, b) => a.name.localeCompare(b.name)) };
  });
}

export async function POST(request: Request) {
  return conversionResponse(async () => {
    const params = createSchema.parse(await request.json());
    const history = createManualHistoryRecorder('conversion_create', '[Conversions] History failed:');
    try {
      const result = await createUnitConversion(params);
      await history.record({ status: result.created ? 'success' : 'skipped', message: result.created ? 'Created a custom unit conversion.' : 'The conversion already exists.', summary: result,
        events: result.created ? [buildManualHistoryEvent({ level: 'info', category: 'mapping', entityKind: 'unit', entityRef: `conversion:${result.conversionId}`, message: `Created conversion ${params.fromGrocyUnitId} → ${params.toGrocyUnitId}, factor ${params.factor}.`, details: result })] : [] });
      return result;
    } catch (error) {
      await history.record({ status: 'failure', message: 'Custom unit conversion failed.', events: [buildManualHistoryEvent({ level: 'error', category: 'mapping', message: error instanceof Error ? error.message : 'Conversion creation failed.' })] });
      throw error;
    }
  });
}

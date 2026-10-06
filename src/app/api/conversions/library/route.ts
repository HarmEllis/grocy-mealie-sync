import { getConversionLibrary } from '@/lib/conversions/catalog';
import { libraryQuerySchema } from '@/lib/conversions/contracts';
import { conversionResponse } from '../helpers';

export async function GET(request: Request) {
  return conversionResponse(async () => getConversionLibrary(libraryQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams))));
}

import { importConversionLibrary } from '@/lib/use-cases/conversions/library';
import { conversionResponse } from '../helpers';

export async function POST(request: Request) {
  return conversionResponse(async () => importConversionLibrary(await request.json()));
}

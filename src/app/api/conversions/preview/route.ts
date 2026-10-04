import { previewConversionImport } from '@/lib/use-cases/conversions/library';
import { conversionResponse } from '../helpers';

export async function POST(request: Request) {
  return conversionResponse(async () => previewConversionImport(await request.json()));
}

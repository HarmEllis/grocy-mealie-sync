import { NextResponse } from 'next/server';
import { DEVICE_BARCODE_PATTERN, linkDeviceBarcode } from '@/lib/use-cases/devices/scanner';
import { deviceErrorResponse, parseJsonBody } from '../../../helpers';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId < 1) {
    return NextResponse.json({ error: 'Invalid product id' }, { status: 400 });
  }

  const body = await parseJsonBody(request) as { barcode?: unknown } | null;
  const barcode = typeof body?.barcode === 'string' ? body.barcode : '';
  if (!DEVICE_BARCODE_PATTERN.test(barcode)) {
    return NextResponse.json({ error: 'Invalid barcode' }, { status: 400 });
  }

  try {
    return NextResponse.json(await linkDeviceBarcode({ productId, barcode }));
  } catch (error) {
    return deviceErrorResponse(error);
  }
}

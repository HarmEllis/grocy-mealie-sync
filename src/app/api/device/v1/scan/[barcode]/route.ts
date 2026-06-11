import { NextResponse } from 'next/server';
import { DEVICE_BARCODE_PATTERN, scanDeviceBarcode } from '@/lib/use-cases/devices/scanner';
import { deviceErrorResponse } from '../../helpers';

export async function GET(
  _request: Request,
  context: { params: Promise<{ barcode: string }> },
) {
  const { barcode } = await context.params;
  if (!DEVICE_BARCODE_PATTERN.test(barcode)) {
    return NextResponse.json({ error: 'Invalid barcode' }, { status: 400 });
  }

  try {
    return NextResponse.json(await scanDeviceBarcode(barcode));
  } catch (error) {
    return deviceErrorResponse(error);
  }
}

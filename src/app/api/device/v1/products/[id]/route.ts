import { NextResponse } from 'next/server';
import { getDeviceProduct } from '@/lib/use-cases/devices/scanner';
import { deviceErrorResponse } from '../../helpers';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId < 1) {
    return NextResponse.json({ error: 'Invalid product id' }, { status: 400 });
  }

  try {
    return NextResponse.json(await getDeviceProduct(productId));
  } catch (error) {
    return deviceErrorResponse(error);
  }
}

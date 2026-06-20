import { NextResponse } from 'next/server';
import {
  createDeviceProduct,
  DEVICE_BARCODE_PATTERN,
  searchDeviceProducts,
} from '@/lib/use-cases/devices/scanner';
import { deviceErrorResponse, parseJsonBody } from '../helpers';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('query')?.trim() ?? '';
  if (!query) {
    return NextResponse.json({ error: 'Query must not be empty' }, { status: 400 });
  }

  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? undefined : Number(rawLimit);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    return NextResponse.json({ error: 'Limit must be a positive integer' }, { status: 400 });
  }

  try {
    return NextResponse.json(await searchDeviceProducts({ query, limit }));
  } catch (error) {
    return deviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const body = await parseJsonBody(request) as { name?: unknown; barcode?: unknown } | null;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const barcode = typeof body?.barcode === 'string' ? body.barcode : '';

  if (!name) {
    return NextResponse.json({ error: 'Name must not be empty' }, { status: 400 });
  }
  if (!DEVICE_BARCODE_PATTERN.test(barcode)) {
    return NextResponse.json({ error: 'Invalid barcode' }, { status: 400 });
  }

  try {
    const product = await createDeviceProduct({ name, barcode });
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return deviceErrorResponse(error);
  }
}

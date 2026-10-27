import { NextResponse } from 'next/server';
import {
  listDeviceProductsByLabel,
  listDeviceProductsByLetter,
} from '@/lib/use-cases/devices/browse';
import {
  createDeviceProduct,
  createDeviceProductFromMealieFood,
  DEVICE_BARCODE_PATTERN,
  searchDeviceProducts,
} from '@/lib/use-cases/devices/scanner';
import { deviceErrorResponse, parseJsonBody } from '../helpers';

const SELECTOR_KEYS = ['query', 'labelId', 'letter'] as const;
const ALLOWED_KEYS = new Set<string>([...SELECTOR_KEYS, 'offset', 'limit', 'include']);
const LETTER_PATTERN = /^[A-Z#]$/;
const BROWSE_MAX_LIMIT = 20;

function parseOffset(raw: string | null): number | { error: string } {
  if (raw === null) {
    return 0;
  }
  const value = Number(raw);
  // Safe integers only: the device echoes `offset` back, and an unsafe value
  // such as 1e300 would serialize as an exponent outside the wire budget.
  if (!Number.isSafeInteger(value) || value < 0) {
    return { error: 'Offset must be a non-negative integer' };
  }
  return value;
}

function parseBrowseLimit(raw: string | null): number | { error: string } {
  if (raw === null) {
    return BROWSE_MAX_LIMIT;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > BROWSE_MAX_LIMIT) {
    return { error: `Limit must be an integer between 1 and ${BROWSE_MAX_LIMIT}` };
  }
  return value;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  for (const key of new Set(params.keys())) {
    if (!ALLOWED_KEYS.has(key)) {
      return NextResponse.json({ error: `Unknown query parameter: ${key}` }, { status: 400 });
    }
    if (params.getAll(key).length > 1) {
      return NextResponse.json({ error: `Duplicate query parameter: ${key}` }, { status: 400 });
    }
  }

  const present = SELECTOR_KEYS.filter(key => params.has(key));
  if (present.length !== 1) {
    return NextResponse.json(
      { error: 'Exactly one of query, labelId, or letter is required' },
      { status: 400 },
    );
  }
  const selector = present[0];

  const include = params.get('include');
  if (include !== null && (selector !== 'query' || include !== 'mealie')) {
    return NextResponse.json({ error: 'include is only supported as include=mealie with query' }, { status: 400 });
  }

  if (selector === 'query') {
    if (params.has('offset')) {
      return NextResponse.json({ error: 'offset is not supported with query' }, { status: 400 });
    }
    const query = params.get('query')?.trim() ?? '';
    if (!query) {
      return NextResponse.json({ error: 'Query must not be empty' }, { status: 400 });
    }
    const rawLimit = params.get('limit');
    const limit = rawLimit === null ? undefined : Number(rawLimit);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
      return NextResponse.json({ error: 'Limit must be a positive integer' }, { status: 400 });
    }
    try {
      return NextResponse.json(await searchDeviceProducts(include === 'mealie' ? { query, limit, includeMealie: true } : { query, limit }));
    } catch (error) {
      return deviceErrorResponse(error);
    }
  }

  const offset = parseOffset(params.get('offset'));
  if (typeof offset !== 'number') {
    return NextResponse.json({ error: offset.error }, { status: 400 });
  }
  const limit = parseBrowseLimit(params.get('limit'));
  if (typeof limit !== 'number') {
    return NextResponse.json({ error: limit.error }, { status: 400 });
  }

  try {
    if (selector === 'labelId') {
      const labelId = params.get('labelId')!.trim();
      if (!labelId) {
        return NextResponse.json({ error: 'labelId must not be empty' }, { status: 400 });
      }
      return NextResponse.json(await listDeviceProductsByLabel({ labelId, offset, limit }));
    }

    const letter = params.get('letter')!.trim().toUpperCase();
    if (!LETTER_PATTERN.test(letter)) {
      return NextResponse.json({ error: 'letter must be a single character A-Z or #' }, { status: 400 });
    }
    return NextResponse.json(await listDeviceProductsByLetter({ letter, offset, limit }));
  } catch (error) {
    return deviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const rawBody = await parseJsonBody(request);
  const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
    ? rawBody as { name?: unknown; barcode?: unknown; mealieFoodId?: unknown }
    : null;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const barcode = typeof body?.barcode === 'string' ? body.barcode : '';

  if (body && 'mealieFoodId' in body) {
    // Never fall back to creating a brand-new product when the id is unusable.
    const mealieFoodId = typeof body.mealieFoodId === 'string' ? body.mealieFoodId.trim() : '';
    if (!mealieFoodId) {
      return NextResponse.json({ error: 'mealieFoodId must be a non-empty string' }, { status: 400 });
    }
    if (!DEVICE_BARCODE_PATTERN.test(barcode)) {
      return NextResponse.json({ error: 'Invalid barcode' }, { status: 400 });
    }
    try {
      const product = await createDeviceProductFromMealieFood({ mealieFoodId, barcode });
      return NextResponse.json(product, { status: 201 });
    } catch (error) {
      return deviceErrorResponse(error);
    }
  }

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

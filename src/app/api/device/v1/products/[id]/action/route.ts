import { NextResponse } from 'next/server';
import {
  performDeviceAction,
  type DeviceAction,
} from '@/lib/use-cases/devices/scanner';
import { deviceErrorResponse, parseJsonBody } from '../../../helpers';

const DEVICE_ACTIONS: readonly DeviceAction[] = [
  'purchase',
  'open',
  'consume',
  'add_to_shopping_list',
];

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId < 1) {
    return NextResponse.json({ error: 'Invalid product id' }, { status: 400 });
  }

  const body = await parseJsonBody(request) as { action?: unknown; amount?: unknown } | null;
  const action = body?.action;
  if (typeof action !== 'string' || !DEVICE_ACTIONS.includes(action as DeviceAction)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  let amount: number | undefined;
  if (body?.amount !== undefined) {
    amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }
  }

  try {
    const result = await performDeviceAction({
      productId,
      action: action as DeviceAction,
      amount,
    });
    return NextResponse.json(result);
  } catch (error) {
    return deviceErrorResponse(error);
  }
}

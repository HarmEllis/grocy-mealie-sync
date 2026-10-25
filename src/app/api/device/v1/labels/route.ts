import { NextResponse } from 'next/server';
import { listDeviceLabels } from '@/lib/use-cases/devices/browse';
import { deviceErrorResponse } from '../helpers';

export async function GET() {
  try {
    return NextResponse.json(await listDeviceLabels());
  } catch (error) {
    return deviceErrorResponse(error);
  }
}

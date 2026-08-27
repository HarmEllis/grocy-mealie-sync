import { NextResponse } from 'next/server';
import { listDeviceLetters } from '@/lib/use-cases/devices/browse';
import { deviceErrorResponse } from '../helpers';

export async function GET() {
  try {
    return NextResponse.json(await listDeviceLetters());
  } catch (error) {
    return deviceErrorResponse(error);
  }
}

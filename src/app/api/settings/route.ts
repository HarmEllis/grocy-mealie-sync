import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { unitMappings } from '@/lib/db/schema';

export async function GET() {
  const settings = await getSettings();
  const units = await db.select().from(unitMappings);

  return NextResponse.json({
    defaultUnitMappingId: settings.defaultUnitMappingId,
    availableUnits: units.map(u => ({
      id: u.id,
      name: u.mealieUnitName,
      abbreviation: u.mealieUnitAbbreviation,
      grocyUnitId: u.grocyUnitId,
      grocyUnitName: u.grocyUnitName,
    })),
  });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { defaultUnitMappingId } = body;

  if (defaultUnitMappingId !== null && typeof defaultUnitMappingId !== 'string') {
    return NextResponse.json({ error: 'defaultUnitMappingId must be a string or null' }, { status: 400 });
  }

  const settings = await getSettings();
  settings.defaultUnitMappingId = defaultUnitMappingId;
  await saveSettings(settings);

  return NextResponse.json({ status: 'ok', defaultUnitMappingId });
}

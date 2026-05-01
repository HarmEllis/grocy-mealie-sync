import { NextResponse } from 'next/server';
import { getSyncState } from '@/lib/sync/state';
import { db } from '@/lib/db';
import { productMappings, unitMappings } from '@/lib/db/schema';
import { count } from 'drizzle-orm';
import { getNextCleanupRun, getSchedulerRuntimeState } from '@/lib/sync/scheduler';
import { getSchedulerInstanceOwnerId, getSchedulerLockOwnerId } from '@/lib/sync/mutex';

export async function GET() {
  const state = await getSyncState();
  const [productCount] = await db.select({ count: count() }).from(productMappings);
  const [unitCount] = await db.select({ count: count() }).from(unitMappings);
  const schedulerRuntime = getSchedulerRuntimeState();
  const lockOwnerId = getSchedulerLockOwnerId();
  const schedulerStatus = schedulerRuntime.status === 'inactive'
    && lockOwnerId !== null
    && lockOwnerId !== getSchedulerInstanceOwnerId()
    ? 'passive_startup_lock'
    : schedulerRuntime.status;

  return NextResponse.json({
    lastGrocyPoll: state.lastGrocyPoll,
    lastMealiePoll: state.lastMealiePoll,
    grocyBelowMinStockCount: Object.keys(state.grocyBelowMinStock).length,
    mealieTrackedItemsCount: Object.keys(state.mealieCheckedItems).length,
    productMappings: productCount.count,
    unitMappings: unitCount.count,
    nextCleanupRun: getNextCleanupRun(),
    schedulerStatus,
  });
}

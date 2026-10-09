import { eq } from 'drizzle-orm';
import { db } from '../db';
import { appMeta } from '../db/schema';
import { parseStoredJson } from './stored-json';
import type { ProjectionReview } from './projection';

function key(installationId: string): string {
  return `shop-projection-review:${installationId}`;
}

/** Keep the latest projection reasons available while upstream services are offline. */
export function saveProjectionReview(installationId: string, review: ProjectionReview[]): void {
  const value = JSON.stringify(review);
  db.insert(appMeta).values({ key: key(installationId), value })
    .onConflictDoUpdate({ target: appMeta.key, set: { value } }).run();
}

export function getProjectionReview(installationId: string): ProjectionReview[] {
  const row = db.select().from(appMeta).where(eq(appMeta.key, key(installationId))).get();
  return parseStoredJson<ProjectionReview[]>(row?.value, []);
}

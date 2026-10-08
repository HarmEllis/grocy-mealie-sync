import { eq, like } from 'drizzle-orm';
import { db } from '../db';
import { appMeta, pluginInstallations } from '../db/schema';

export const NOTE_PREFERENCE_PREFIX = 'shop-note-preference:';

/** Forget choices when their preferred mapping is deleted, demoted or moved. */
export function pruneManualNotePreference(providerId: string, retailerProductId: string): void {
  for (const installation of db.select().from(pluginInstallations).where(eq(pluginInstallations.providerId, providerId)).all()) {
    for (const row of db.select().from(appMeta).where(like(appMeta.key, `${NOTE_PREFERENCE_PREFIX}${installation.id}:%`)).all()) {
      let values: unknown;
      try { values = JSON.parse(row.value); } catch { continue; }
      if (!Array.isArray(values) || !values.includes(retailerProductId)) continue;
      const remaining = values.filter(value => typeof value === 'string' && value !== retailerProductId);
      if (remaining.length) db.update(appMeta).set({ value: JSON.stringify(remaining) }).where(eq(appMeta.key, row.key)).run();
      else db.delete(appMeta).where(eq(appMeta.key, row.key)).run();
    }
  }
}

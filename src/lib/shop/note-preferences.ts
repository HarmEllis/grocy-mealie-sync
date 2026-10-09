import { NOTE_PREFERENCE_PREFIX as PREFIX } from './note-preference-store';
import { createHash } from 'crypto';
import { eq, like } from 'drizzle-orm';
import { db } from '../db';
import { appMeta } from '../db/schema';
import { getInstallation, type PluginInstallation } from '../plugins/installations';
import { FEATURES } from '../plugins/protocol/v1';
import { ShopApiError } from './api-helpers';
import { getRetailerMapping, getRetailerProduct } from './retailer-catalog';

/**
 * Manual "use a note instead" choices for preferred retailer products.
 *
 * Some retailers never say a product is gone (AH only reports orderable
 * products), so the user can ask for the free-text note by hand. The choice is
 * stored per installation and bound retailer account, never on the shared
 * catalogue product, so another installation or account is unaffected and a
 * binding reset forgets it. It only changes the desired list state; the list
 * sync applies it with the usual staged transitions and keeps all demand,
 * exports and receipt attribution.
 */


function accountScope(installation: Pick<PluginInstallation, 'settings'>): string | null {
  const account = installation.settings.boundAccountKey;
  return account ? createHash('sha256').update(account).digest('hex').slice(0, 32) : null;
}

function preferenceKey(installationId: string, scope: string): string {
  return `${PREFIX}${installationId}:${scope}`;
}

/** Retailer products this installation's current account shows as a note by choice. */
export function manualNoteProductIds(installationId: string): string[] {
  const installation = getInstallation(installationId);
  const scope = installation ? accountScope(installation) : null;
  if (!scope) return [];
  const row = db.select().from(appMeta).where(eq(appMeta.key, preferenceKey(installationId, scope))).get();
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string').sort() : [];
  } catch {
    return [];
  }
}

/** Forget every account's choices, for example when the binding is reset. */
export function clearManualNotePreferences(installationId: string): void {
  db.delete(appMeta).where(like(appMeta.key, `${PREFIX}${installationId}:%`)).run();
}

export interface ListFallbackInput {
  installationId: string;
  retailerProductId: string;
  mode: 'note' | 'product';
}

export interface ListFallbackResult {
  installationId: string;
  retailerProductId: string;
  mode: 'note' | 'product';
  manualNoteProductIds: string[];
}

/** Validate and store a manual list representation. Makes no list write itself. */
export function setListFallbackMode(input: ListFallbackInput): ListFallbackResult {
  return db.transaction(() => {
    const installation = getInstallation(input.installationId);
    if (!installation || installation.revokedAt || !installation.providerId) throw new ShopApiError(404, 'Installation not found or never connected');
    const scope = accountScope(installation);
    if (!scope) throw new ShopApiError(409, 'Sign in to the retailer account first; the choice is stored for that account.');
    const manifest = installation.manifest;
    if (!manifest?.capabilities.includes('list') || !manifest.features?.includes(FEATURES.listNotes)) {
      throw new ShopApiError(409, 'This plugin cannot write text notes on the shopping list.');
    }
    const mapping = getRetailerMapping(installation.providerId, input.retailerProductId);
    if (!mapping || mapping.role !== 'preferred') {
      throw new ShopApiError(409, 'Only the preferred retailer product of a target can be shown as a note.');
    }
    if (input.mode === 'product' && getRetailerProduct(installation.providerId, input.retailerProductId)?.availability === 'discontinued') {
      throw new ShopApiError(409, 'The retailer reports this product as no longer sold, so it stays a note.');
    }
    const current = new Set(manualNoteProductIds(installation.id));
    if (input.mode === 'note') current.add(input.retailerProductId);
    else current.delete(input.retailerProductId);
    const key = preferenceKey(installation.id, scope);
    if (current.size === 0) {
      db.delete(appMeta).where(eq(appMeta.key, key)).run();
    } else {
      const value = JSON.stringify([...current].sort());
      db.insert(appMeta).values({ key, value }).onConflictDoUpdate({ target: appMeta.key, set: { value } }).run();
    }
    return { installationId: installation.id, retailerProductId: input.retailerProductId, mode: input.mode, manualNoteProductIds: manualNoteProductIds(installation.id) };
  });
}

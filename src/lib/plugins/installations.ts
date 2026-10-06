import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { pluginInstallations } from '../db/schema';
import { parsePluginToken, type HelloParams, type PluginAuthState } from './protocol/v1';

export type PluginInstallationRow = typeof pluginInstallations.$inferSelect;

export const installationSettingsSchema = z.object({
  /** Project open demand onto the retailer's shared shopping list. */
  listSyncEnabled: z.boolean().default(false),
  /** Pull receipts and process them automatically. */
  receiptsEnabled: z.boolean().default(false),
  /** Receipts purchased before this moment are stored as headers and ignored. Only moves forward. */
  receiptsActivatedAt: z.string().nullable().default(null),
  /** Grocy store ("shopping location") used for purchases booked from receipts. */
  grocyShoppingLocationId: z.number().int().positive().nullable().default(null),
  /**
   * Retailer account this installation is bound to (server managed). A
   * different signed-in account is refused until the user resets the binding,
   * so list ownership, receipts and effects never mix accounts.
   */
  boundAccountKey: z.string().nullable().default(null),
  /** Shared list ownership applies to this list only (server managed). */
  pinnedListId: z.string().nullable().default(null),
});
export type InstallationSettings = z.infer<typeof installationSettingsSchema>;

export const installationSettingsPatchSchema = z.object({
  listSyncEnabled: z.boolean().optional(),
  receiptsEnabled: z.boolean().optional(),
  grocyShoppingLocationId: z.number().int().positive().nullable().optional(),
}).strict();
export type InstallationSettingsPatch = z.infer<typeof installationSettingsPatchSchema>;

export interface PluginInstallation {
  id: string;
  name: string;
  tokenHint: string;
  providerId: string | null;
  providerLabel: string | null;
  accountKey: string | null;
  accountLabel: string | null;
  authState: PluginAuthState | null;
  manifest: HelloParams | null;
  settings: InstallationSettings;
  createdAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  lastSeenAt: Date | null;
}

export function hashPluginToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function generateToken(installationId: string): string {
  return `gmsp_${installationId}_${randomBytes(32).toString('base64url')}`;
}

function tokenHint(token: string): string {
  return token.slice(-4);
}

export function parseInstallationSettings(raw: string | null | undefined): InstallationSettings {
  let value: unknown = {};
  try {
    value = raw ? JSON.parse(raw) : {};
  } catch {
    value = {};
  }
  const parsed = installationSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : installationSettingsSchema.parse({});
}

function parseManifest(raw: string | null): HelloParams | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as HelloParams;
  } catch {
    return null;
  }
}

export function toPluginInstallation(row: PluginInstallationRow): PluginInstallation {
  return {
    id: row.id,
    name: row.name,
    tokenHint: row.tokenHint,
    providerId: row.providerId,
    providerLabel: row.providerLabel,
    accountKey: row.accountKey,
    accountLabel: row.accountLabel,
    authState: (row.authState as PluginAuthState | null) ?? null,
    manifest: parseManifest(row.manifestJson),
    settings: parseInstallationSettings(row.settingsJson),
    createdAt: row.createdAt,
    rotatedAt: row.rotatedAt,
    revokedAt: row.revokedAt,
    lastSeenAt: row.lastSeenAt,
  };
}

export function createInstallation(name: string, now = new Date()): { installation: PluginInstallation; token: string } {
  const id = randomBytes(12).toString('hex');
  const token = generateToken(id);
  db.insert(pluginInstallations).values({
    id,
    name,
    tokenHash: hashPluginToken(token),
    tokenHint: tokenHint(token),
    settingsJson: JSON.stringify(installationSettingsSchema.parse({})),
    createdAt: now,
  }).run();
  return { installation: getInstallationOrThrow(id), token };
}

export function listInstallations(options: { includeRevoked?: boolean } = {}): PluginInstallation[] {
  const rows = db.select().from(pluginInstallations).orderBy(desc(pluginInstallations.createdAt)).all();
  return rows
    .filter(row => options.includeRevoked || row.revokedAt === null)
    .map(toPluginInstallation);
}

export function getInstallation(id: string): PluginInstallation | null {
  const row = db.select().from(pluginInstallations).where(eq(pluginInstallations.id, id)).get();
  return row ? toPluginInstallation(row) : null;
}

function getInstallationOrThrow(id: string): PluginInstallation {
  const installation = getInstallation(id);
  if (!installation) throw new Error(`Plugin installation ${id} not found`);
  return installation;
}

export function hasActiveInstallations(): boolean {
  return db.select({ id: pluginInstallations.id, revokedAt: pluginInstallations.revokedAt })
    .from(pluginInstallations)
    .all()
    .some(row => row.revokedAt === null);
}

export function renameInstallation(id: string, name: string): PluginInstallation | null {
  db.update(pluginInstallations).set({ name }).where(eq(pluginInstallations.id, id)).run();
  return getInstallation(id);
}

export function revokeInstallation(id: string, now = new Date()): PluginInstallation | null {
  db.update(pluginInstallations).set({ revokedAt: now }).where(eq(pluginInstallations.id, id)).run();
  return getInstallation(id);
}

export function rotateInstallationToken(id: string, now = new Date()): { installation: PluginInstallation; token: string } | null {
  const existing = getInstallation(id);
  if (!existing || existing.revokedAt) return null;
  const token = generateToken(id);
  db.update(pluginInstallations)
    .set({ tokenHash: hashPluginToken(token), tokenHint: tokenHint(token), rotatedAt: now })
    .where(eq(pluginInstallations.id, id))
    .run();
  return { installation: getInstallationOrThrow(id), token };
}

/**
 * Apply a settings patch. Enabling receipts moves the activation boundary
 * forward to `now`, so receipts bought while processing was off are never
 * booked retroactively.
 */
export function updateInstallationSettings(
  id: string,
  patch: InstallationSettingsPatch,
  options: { now?: Date; ledgerActivatedAt?: Date | null } = {},
): PluginInstallation | null {
  const existing = getInstallation(id);
  if (!existing) return null;
  const now = options.now ?? new Date();
  const next: InstallationSettings = { ...existing.settings, ...patch };
  if (patch.receiptsEnabled === true && !existing.settings.receiptsEnabled) {
    const candidates = [now.getTime(), options.ledgerActivatedAt?.getTime() ?? 0];
    if (existing.settings.receiptsActivatedAt) candidates.push(new Date(existing.settings.receiptsActivatedAt).getTime());
    next.receiptsActivatedAt = new Date(Math.max(...candidates)).toISOString();
  }
  db.update(pluginInstallations)
    .set({ settingsJson: JSON.stringify(next) })
    .where(eq(pluginInstallations.id, id))
    .run();
  return getInstallation(id);
}

/** Resolve a bearer token to its active installation, in constant time per candidate. */
export function authenticatePluginToken(token: string): PluginInstallation | null {
  const parsed = parsePluginToken(token);
  if (!parsed) return null;
  const row = db.select().from(pluginInstallations).where(eq(pluginInstallations.id, parsed.installationId)).get();
  if (!row || row.revokedAt !== null) return null;
  const expected = Buffer.from(row.tokenHash, 'hex');
  const actual = Buffer.from(hashPluginToken(token.trim()), 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return toPluginInstallation(row);
}

export type HelloRecordResult = { ok: true; installation: PluginInstallation } | { ok: false; reason: string };

function writeSettings(id: string, settings: InstallationSettings): void {
  db.update(pluginInstallations).set({ settingsJson: JSON.stringify(settings) }).where(eq(pluginInstallations.id, id)).run();
}

function accountMismatch(settings: InstallationSettings, accountKey: string | null): string | null {
  if (!accountKey || !settings.boundAccountKey || settings.boundAccountKey === accountKey) return null;
  return 'The plugin is signed in to a different retailer account than this installation is bound to. Reset the account binding in gm-sync before using it.';
}

/** Pin the shared list on first use; returns false when the plugin now reports a different list. */
export function pinListId(id: string, listId: string): boolean {
  const installation = getInstallation(id);
  if (!installation) return false;
  if (installation.settings.pinnedListId === listId) return true;
  if (installation.settings.pinnedListId) return false;
  writeSettings(id, { ...installation.settings, pinnedListId: listId });
  return true;
}

/** Explicit, reviewed reset of the account binding and pinned list. */
export function resetInstallationBinding(id: string): PluginInstallation | null {
  const installation = getInstallation(id);
  if (!installation) return null;
  writeSettings(id, {
    ...installation.settings, boundAccountKey: null, pinnedListId: null,
    listSyncEnabled: false, receiptsEnabled: false,
  });
  return getInstallation(id);
}

/**
 * Persist the plugin's self-description. An installation is bound to the
 * first provider it reports; a token reused by a different provider is refused
 * so receipts and list ownership can never be attributed to the wrong shop.
 */
export function recordHello(id: string, hello: HelloParams, now = new Date()): HelloRecordResult {
  const existing = getInstallation(id);
  if (!existing || existing.revokedAt) return { ok: false, reason: 'Installation is revoked' };
  if (existing.providerId && existing.providerId !== hello.providerId) {
    return {
      ok: false,
      reason: `This token belongs to provider "${existing.providerId}", not "${hello.providerId}". Create a separate installation.`,
    };
  }
  const mismatch = accountMismatch(existing.settings, hello.accountKey);
  if (mismatch) return { ok: false, reason: mismatch };
  if (hello.accountKey && !existing.settings.boundAccountKey) {
    writeSettings(id, { ...existing.settings, boundAccountKey: hello.accountKey });
  }
  db.update(pluginInstallations).set({
    providerId: hello.providerId,
    providerLabel: hello.providerLabel,
    accountKey: hello.accountKey,
    accountLabel: hello.accountLabel,
    authState: hello.authState,
    manifestJson: JSON.stringify(hello),
    lastSeenAt: now,
  }).where(eq(pluginInstallations.id, id)).run();
  return { ok: true, installation: getInstallationOrThrow(id) };
}

export function recordAuthChanged(
  id: string,
  data: { authState: PluginAuthState; accountKey: string | null; accountLabel: string | null },
  now = new Date(),
): { ok: true } | { ok: false; reason: string } {
  const existing = getInstallation(id);
  if (!existing) return { ok: false, reason: 'Installation not found' };
  const mismatch = accountMismatch(existing.settings, data.accountKey);
  if (mismatch) return { ok: false, reason: mismatch };
  if (data.accountKey && !existing.settings.boundAccountKey) {
    writeSettings(id, { ...existing.settings, boundAccountKey: data.accountKey });
  }
  db.update(pluginInstallations).set({
    authState: data.authState,
    accountKey: data.accountKey,
    accountLabel: data.accountLabel,
    lastSeenAt: now,
  }).where(eq(pluginInstallations.id, id)).run();
  return { ok: true };
}

export function touchInstallation(id: string, now = new Date()): void {
  db.update(pluginInstallations).set({ lastSeenAt: now }).where(eq(pluginInstallations.id, id)).run();
}

import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { checkLifecycles, productMappings, receiptLines, receipts, reconciliationLinks } from '../db/schema';
import { listOpenDemand } from './demand-observer';
import { listInstallations, type PluginInstallation } from '../plugins/installations';
import { getPluginGateway } from '../plugins/runtime';
import { listDiscrepancies } from './discrepancies';
import { listEffects } from './ledger';
import { getPendingListApply, listLineRecords } from './list-sync';
import { listActiveExports } from './projection';
import { getReceiptCursor } from './receipts';
import { listRetailerMappings, listRetailerProducts } from './retailer-catalog';

export interface InstallationView {
  id: string;
  name: string;
  tokenHint: string;
  providerId: string | null;
  providerLabel: string | null;
  accountLabel: string | null;
  authState: string | null;
  pluginName: string | null;
  pluginVersion: string | null;
  capabilities: string[];
  connected: boolean;
  connectedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  settings: PluginInstallation['settings'];
  receiptCursor: { lastPullAt: string | null; lastError: string | null; resuming: boolean } | null;
  pendingListApply: boolean;
}

export function installationViews(): InstallationView[] {
  const gateway = getPluginGateway();
  return listInstallations().map((installation) => {
    const session = gateway?.getSession(installation.id) ?? null;
    const manifest = session?.hello ?? installation.manifest;
    const cursor = installation.accountKey ? getReceiptCursor(installation.id, installation.accountKey) : null;
    return {
      id: installation.id,
      name: installation.name,
      tokenHint: installation.tokenHint,
      providerId: installation.providerId,
      providerLabel: installation.providerLabel,
      accountLabel: installation.accountLabel,
      authState: installation.authState,
      pluginName: manifest?.pluginName ?? null,
      pluginVersion: manifest?.pluginVersion ?? null,
      capabilities: manifest?.capabilities ?? [],
      connected: Boolean(session),
      connectedAt: session?.connectedAt.toISOString() ?? null,
      lastSeenAt: installation.lastSeenAt?.toISOString() ?? null,
      createdAt: installation.createdAt.toISOString(),
      settings: installation.settings,
      receiptCursor: cursor ? {
        lastPullAt: cursor.lastPullAt?.toISOString() ?? null,
        lastError: cursor.lastError,
        resuming: Boolean(cursor.pageCursor),
      } : null,
      pendingListApply: Boolean(getPendingListApply(installation.id)),
    };
  });
}

/** Everything the Shopping page shows, read in one go. */
export function shopOverview() {
  const installations = installationViews();
  const productNames = new Map(listRetailerProducts().map(product => [`${product.providerId}:${product.externalId}`, product.name]));
  const providerOf = new Map(installations.map(installation => [installation.id, installation.providerId]));
  const nameOf = (installationId: string, retailerProductId: string) =>
    productNames.get(`${providerOf.get(installationId)}:${retailerProductId}`) ?? retailerProductId;

  const exports = listActiveExports().map(row => ({
    id: row.id,
    installationId: row.installationId,
    retailerProductId: row.retailerProductId,
    productName: nameOf(row.installationId, row.retailerProductId),
    packages: row.packages,
    baseAmount: row.baseAmount,
    createdAt: row.createdAt.toISOString(),
  }));

  const lines = installations.flatMap(installation => listLineRecords(installation.id).map(row => ({
    installationId: installation.id,
    retailerProductId: row.retailerProductId,
    productName: nameOf(installation.id, row.retailerProductId),
    managedQty: row.managedQty,
    baselineUserQty: row.baselineUserQty,
    lastWrittenQty: row.lastWrittenQty,
    pausedReason: row.pausedReason,
    pausedObservedQty: row.pausedObservedQty,
  })));

  const retailerMappings = new Map(listRetailerMappings().map(mapping => [`${mapping.providerId}:${mapping.retailerProductId}`, mapping]));
  const recentReceipts = db.select().from(receipts).orderBy(desc(receipts.purchasedAt)).limit(50).all();
  const receiptIds = recentReceipts.map(row => row.id);
  const lineRows = receiptIds.length > 0 ? db.select().from(receiptLines).where(inArray(receiptLines.receiptId, receiptIds)).all() : [];
  const lineIds = lineRows.map(row => row.id);
  const links = lineIds.length > 0 ? db.select().from(reconciliationLinks).where(inArray(reconciliationLinks.receiptLineId, lineIds)).all() : [];
  const receiptViews = recentReceipts.map(receipt => ({
    id: receipt.id,
    installationId: receipt.installationId,
    externalReceiptId: receipt.externalReceiptId,
    providerId: receipt.providerId,
    referenceOnly: receipt.status === 'reference_only' || receipt.status === 'ignored_before_activation',
    purchasedAt: receipt.purchasedAt.toISOString(),
    storeLabel: receipt.storeLabel,
    totalCents: receipt.totalCents,
    status: receipt.status,
    lines: lineRows.filter(line => line.receiptId === receipt.id).sort((a, b) => a.lineNo - b.lineNo).map(line => ({
      id: line.id,
      lineNo: line.lineNo,
      kind: line.kind,
      retailerProductId: line.retailerProductId,
      description: line.description,
      mapping: retailerMappings.get(`${receipt.providerId}:${line.retailerProductId}`) ?? null,
      quantity: line.quantity,
      unit: line.unit,
      amountCents: line.amountCents,
      status: line.status,
      reviewReason: line.reviewReason,
      links: links.filter(link => link.receiptLineId === line.id).map(link => ({
        kind: link.kind, baseAmount: link.baseAmount, mealieItemId: link.mealieItemId, lifecycleId: link.lifecycleId, effectId: link.effectId,
      })),
    })),
  }));

  const review = receiptViews.flatMap(receipt => receipt.lines
    .filter(line => line.status === 'review')
    .map(line => ({ ...line, receiptId: receipt.id, purchasedAt: receipt.purchasedAt, installationId: receipt.installationId })));

  const attention = listEffects({ statuses: ['unknown', 'not_applied'] }).map(effect => ({
    id: effect.id,
    kind: effect.kind,
    sourceKind: effect.sourceKind,
    sourceRef: effect.sourceRef,
    status: effect.status,
    attempts: effect.attempts,
    payload: effect.payload,
    evidence: effect.evidence,
    error: effect.error,
    updatedAt: effect.updatedAt.toISOString(),
  }));

  const recentChecks = db.select().from(checkLifecycles).where(eq(checkLifecycles.status, 'completed'))
    .orderBy(desc(checkLifecycles.checkedObservedAt)).limit(50).all()
    .map(lifecycle => ({
      id: lifecycle.id,
      mealieItemId: lifecycle.mealieItemId,
      grocyProductId: lifecycle.grocyProductId,
      quantity: lifecycle.quantity,
      checkedObservedAt: lifecycle.checkedObservedAt.toISOString(),
    }));

  const discrepancyViews = listDiscrepancies('open').map(row => {
    let evidence: unknown = null;
    try {
      evidence = JSON.parse(row.evidenceJson);
    } catch {
      evidence = null;
    }
    return { id: row.id, kind: row.kind, receiptLineId: row.receiptLineId, lifecycleId: row.lifecycleId, evidence, createdAt: row.createdAt.toISOString() };
  });

  const foodNames = new Map(db.select().from(productMappings).all().map(row => [row.mealieFoodId, row.mealieFoodName]));
  const openDemand = listOpenDemand().map(({ demand, revision }) => ({
    mealieItemId: demand.mealieItemId,
    label: (revision.foodId && foodNames.get(revision.foodId)) || revision.note || 'Unnamed row',
    quantity: revision.quantity,
    observedAt: revision.observedAt.toISOString(),
  }));

  return { installations, exports, lines, receipts: receiptViews, review, effects: attention, discrepancies: discrepancyViews, recentChecks, openDemand };
}

export type ShopOverview = ReturnType<typeof shopOverview>;

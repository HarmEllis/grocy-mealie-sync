import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { installationSettingsPatchSchema } from '@/lib/plugins/installations';
import { invokeShopUiAction, type ShopUiInput, type ShopUiResult } from '@/lib/use-cases/shop/ui-actions';
import { createJsonTextContent } from '../helpers';

export interface ShopMcpServices { invoke(action: string, input?: ShopUiInput): Promise<ShopUiResult> }
const id = z.string().min(1).max(128);
const amount = z.number().positive().finite();
const optionalText = z.string().max(200).optional();
const nullableId = id.nullable();
const mapping = { providerId: id, retailerProductId: id, targetKind: z.enum(['grocy_product', 'mealie_food']), targetId: id, targetName: z.string().min(1).max(200), role: z.enum(['preferred', 'alternative']).optional(), baseUnitId: nullableId.optional(), baseUnitName: z.string().max(100).nullable().optional(), packageBaseAmount: amount.nullable().optional(), confirm: z.boolean().optional(), reassign: z.boolean().optional(), expectedTargetKey: z.string().min(1).max(220).optional(), replacesMappingId: id.optional() };

export function registerShopTools(server: McpServer, services: ShopMcpServices = { invoke: invokeShopUiAction }) {
  function register(name: string, description: string, schema: z.ZodRawShape, readOnly = false, destructive = false,
    action = name, mode: 'body' | 'query' = 'body', extra: Record<string, unknown> = {}) {
    server.registerTool(name, { title: name, description, inputSchema: schema,
      annotations: { readOnlyHint: readOnly, destructiveHint: destructive, openWorldHint: true },
    }, async args => {
      const { id: entityId, ...fields } = args as Record<string, unknown>;
      const input: ShopUiInput = { id: typeof entityId === 'string' ? entityId : undefined };
      if (mode === 'query') input.query = Object.fromEntries(Object.entries(fields).filter(([,v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean').map(([key, value]) => [key, String(value)]));
      else input.body = { ...fields, ...extra };
      const result = await services.invoke(action, input);
      return { content: [createJsonTextContent(result)], structuredContent: { ...result }, ...(result.ok ? {} : { isError: true }) };
    });
  }
  register('plugins.list', 'Read installations, connection/auth state, capabilities, settings and receipt errors. Tokens are never included.', {}, true);
  register('plugins.create', 'Create an installation. Its secret token is returned once; store it in the plugin container configuration.', { name: z.string().trim().min(1).max(80) });
  register('plugins.update', 'Rename an installation or change list sync, receipt processing and Grocy store settings.', { id, name: z.string().trim().min(1).max(80).optional(), settings: installationSettingsPatchSchema.optional() });
  register('plugins.revoke', 'Revoke the installation token and disconnect its plugin immediately.', { id }, false, true);
  register('plugins.rotate_token', 'Invalidate the old token and return its replacement once. Restart the plugin with the new secret.', { id }, false, true);
  register('plugins.reset_binding', 'Sign out the connected plugin, reset account/list binding and disable automation. Stored receipts are retained.', { id }, false, true);
  register('plugins.auth_begin', 'Begin retailer sign-in; returns the same declarative URL/form shown by gm-sync. Never logs entered secrets.', { id }, false, false, 'plugins.auth', 'body', { action: 'begin' });
  register('plugins.auth_submit', 'Submit one retailer sign-in step. Treat values as secrets; never retry a single-use code after failure.', { id, stepId: id, values: z.record(z.string().max(40), z.string().max(4096)) }, false, false, 'plugins.auth', 'body', { action: 'submit' });
  register('plugins.auth_logout', 'Disconnect retailer authentication inside the plugin.', { id }, false, true, 'plugins.auth', 'body', { action: 'logout' });
  register('plugins.catalog_search', 'Search a plugin catalogue, merge saved products and remember live results for mapping review. Returns live/cached/offline status, availability and its last check. Identical queries share a short cache; refresh bypasses it. Does not confirm mappings or buy products.', { id, query: z.string().trim().min(1).max(200), refresh: z.boolean().optional() }, false, false, 'plugins.catalog_search', 'query');
  register('plugins.catalog_refresh', 'Re-read known products through catalog.get to update package data and availability. Omitted products retain stored status; absence never proves discontinued. Returns fresh/offline status and missing IDs. Does not change mappings or shopping demand.', { id, ids: z.array(id).min(1).max(200) });
  register('shop.overview', 'Read all Shop tabs: installations, exports, shared-list ownership, receipts and lines, review items, uncertain effects, discrepancies, manual checks and open Mealie demand.', {}, true);
  register('shop.mappings.list', 'Read stored retailer products, mappings, pending proposals and automatic catalogue search status.', { providerId: id.optional() }, true, false, 'shop.mappings.list', 'query');
  register('shop.mappings.save', 'Map a retailer product to Grocy or Mealie. Confirm only an explicitly checked package amount and supply the expected Grocy baseUnitId. Derived amounts must be echoed explicitly. Reassigning to an unrelated target requires reassign=true; linked Mealie-to-Grocy canonical moves are allowed with unit confirmation. expectedTargetKey guards a previously read mapping during reassignment. replacesMappingId atomically replaces an alternative on the same target.', mapping);
  register('shop.mappings.update', 'Confirm the amount per package or change preferred/alternative role.', { id, packageBaseAmount: amount.optional(), role: z.enum(['preferred', 'alternative']).optional() });
  register('shop.mappings.delete', 'Remove a stored product mapping.', { id }, false, true);
  register('shop.products.list', 'Read the canonical own-product Shop mapping table, including G+M linked products, Grocy-only and Mealie-only products, base units, linked ingredients, counts and pagination. Upstream metadata is cached for 30 seconds; refresh requests a new snapshot. Stored mappings are always current. Pair with shop.mappings.list for each provider column and alternatives. Mapped means a preferred mapping exists for at least one provider, or the selected provider. Known discontinued retailer products stay mapped but cannot be newly selected.', { query: optionalText, refresh: z.boolean().optional(), source: z.enum(['all', 'grocy_mealie', 'grocy', 'mealie']).optional(), mapped: z.enum(['all', 'mapped', 'unmapped']).optional(), providerId: id.optional(), offset: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(200).optional() }, true, false, 'shop.products.list', 'query');
  register('shop.targets.search', 'Search Grocy products and Mealie ingredients. Returns grocy_mealie (recommended), grocy and mealie source prefixes, deduplicated linked foods, stock units and Mealie units. Linked choices come first.', { query: optionalText, suggestFor: optionalText }, true, false, 'shop.targets.search', 'query');
  register('shop.suggestions.decide', 'Accept or reject a proposed product mapping. Rejected pairs stay rejected. Acceptance still needs a confirmed package amount.', { id, action: z.enum(['accept', 'reject']), baseUnitId: nullableId.optional(), baseUnitName: z.string().max(100).nullable().optional(), packageBaseAmount: amount.nullable().optional(), confirm: z.boolean().optional(), reassign: z.boolean().optional() });
  register('shop.searches.retry', 'Queue another automatic catalogue search for an active shopping ingredient.', { id });
  register('shop.lists.fallback', 'Explicitly use one ingredient/quantity text item instead of a preferred retailer product, or restore that product. Applies only to this installation and its bound account; never changes global catalogue availability or chooses alternatives. Requires list.notes support and a preferred mapping. A confirmed discontinued product cannot be restored. Read manualNoteProductIds and features using plugins.list or shop.overview. Uncertain writes settle before changing representation.', { installationId: id, retailerProductId: id, mode: z.enum(['note', 'product']) });
  register('shop.lists.sync', 'Request the plugin worker now. Regular synchronization observes Mealie demand before list projection.', {});
  register('shop.receipts.history', 'Import the latest 5 or 10 retailer receipts for mapping setup, even when receipt processing is disabled. Permanently reference-only: never books stock or fulfils shopping demand. Read details using shop.overview.', { installationId: id, limit: z.union([z.literal(5), z.literal(10)]).default(5) });
  register('shop.mappings.preview', 'Explain the target stock unit, exact package derivation, linked Mealie foods and available/missing unit conversion paths. Does not save or confirm a mapping. Use units and conversions tools to configure missing conversions.', { providerId: id, retailerProductId: id, targetKind: z.enum(['grocy_product', 'mealie_food']), targetId: id, baseUnitId: nullableId.optional() }, true);
  register('shop.receipts.pull', 'Request receipt retrieval for one installation or all enabled plugins.', { installationId: id.optional() });
  register('shop.lines.resolve', 'Resolve a paused shared-list line. Explain removed user units, re-add managed units or release ownership. For a note (kind=note), only release is meaningful; unsupported notes remain visible until released or the plugin gains support.', { installationId: id, retailerProductId: id, resolution: z.enum(['user_units_removed', 'readd', 'release']), kind: z.enum(['product', 'note']).optional() });
  register('shop.review.resolve', 'Resolve one receipt line: dismiss, requeue after mapping, or a reviewed substitution with exact quantities. Supports remembering an alternative.', { id, action: z.enum(['dismiss', 'requeue', 'substitute']), bookGrocyProductId: z.number().int().positive().nullable().optional(), bookGrocyProductName: optionalText, stockAmount: amount.nullable().optional(), mealieItemIds: z.array(id).max(50).optional(), lifecycleIds: z.array(id).max(50).optional(), rememberAsAlternative: z.boolean().optional() }, false, true);
  register('shop.effects.resolve', 'Resolve an uncertain write only after checking evidence: already booked elsewhere, verified not booked and retry, or skip.', { id, action: z.enum(['booked_elsewhere', 'not_booked_retry', 'skip']), transactionId: id.optional(), note: z.string().max(500).optional() }, false, true);
  register('shop.discrepancies.resolve', 'Resolve a receipt/manual-check discrepancy using the same stock/ledger checks as the UI.', { id, action: z.enum(['undo_transaction', 'consume_difference', 'keep_stock', 'book_check', 'skip_check']), transactionId: id.optional(), productId: z.number().int().positive().optional(), amount: amount.optional() }, false, true);
}

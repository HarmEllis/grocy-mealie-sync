/**
 * grocy-mealie-sync shop plugin protocol, version 1.
 *
 * This file is the single source of truth for the wire contract between
 * grocy-mealie-sync ("core") and external shop plugins. It is vendored
 * verbatim into the plugin template (examples/shop-plugin-template); run
 * `npm run plugins:sync-protocol` after editing it. A core test fails when the
 * copies drift apart.
 *
 * Keep this file self-contained: it may only import `zod`, so it runs
 * unchanged under the Next.js bundler and under Node.js type stripping.
 */
import { z } from 'zod';

export const PROTOCOL_VERSION = 1;
export const PLUGIN_SUBPROTOCOL = 'gms-plugin.v1';
export const PLUGIN_CONNECT_PATH = '/api/plugins/connect';
/** Largest accepted WebSocket frame, in bytes. */
export const MAX_FRAME_BYTES = 2 * 1024 * 1024;
/** Maximum outstanding requests per direction and session. */
export const MAX_IN_FLIGHT_REQUESTS = 8;
export const HEARTBEAT_INTERVAL_MS = 30_000;
export const HELLO_TIMEOUT_MS = 10_000;
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

/** Close codes used by core, in the private-use range unless standard. */
export const CLOSE_CODES = {
  normal: 1000,
  goingAway: 1001,
  protocolError: 1002,
  invalidPayload: 1007,
  serviceRestart: 1012,
  superseded: 4000,
  revoked: 4001,
  helloRejected: 4003,
  helloTimeout: 4008,
  unsupportedVersion: 4006,
  providerMismatch: 4009,
} as const;

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export const PLUGIN_TOKEN_PATTERN = /^gmsp_([a-f0-9]{24})_([A-Za-z0-9_-]{43})$/;

export function parsePluginToken(token: string): { installationId: string; secret: string } | null {
  const match = PLUGIN_TOKEN_PATTERN.exec(token.trim());
  return match ? { installationId: match[1], secret: match[2] } : null;
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

const shortText = z.string().min(1).max(200);
const longText = z.string().max(2000);
const identifier = z.string().min(1).max(128);
const isoDateTime = z.iso.datetime({ offset: true });

export const httpsUrlSchema = z.string().max(2048).refine((value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}, 'Only https URLs are allowed');

export const providerIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/, 'Provider IDs are lowercase slugs');

export const CAPABILITIES = ['auth', 'catalog', 'list', 'receipts'] as const;
/** Reserved for future providers (online orders, price comparison). Not implemented by core v1. */
export const RESERVED_CAPABILITIES = ['cart', 'order', 'slots', 'quote', 'promotions'] as const;
export const capabilitySchema = z.enum([...CAPABILITIES, ...RESERVED_CAPABILITIES]);
export type PluginCapability = z.infer<typeof capabilitySchema>;

/**
 * Optional additions to a capability, advertised in `hello.features`. Unknown
 * names are ignored, so an older core still accepts a newer plugin.
 * - `list.notes`: `list.apply` accepts `add_note` and `remove_note` operations.
 */
export const FEATURES = { listNotes: 'list.notes' } as const;
export const featureNameSchema = z.string().min(1).max(64);

export const authStateSchema = z.enum(['authenticated', 'unauthenticated', 'expired', 'unknown']);
export type PluginAuthState = z.infer<typeof authStateSchema>;

export const ERROR_CODES = [
  'BAD_REQUEST',
  'UNAUTHENTICATED',
  'NOT_SUPPORTED',
  'NOT_FOUND',
  'CONFLICT',
  'UPSTREAM_CHANGED',
  'UPSTREAM_UNAVAILABLE',
  'TOO_MANY_REQUESTS',
  'TIMEOUT',
  'INTERNAL',
] as const;
export const errorCodeSchema = z.enum(ERROR_CODES);
export type PluginErrorCode = z.infer<typeof errorCodeSchema>;

/**
 * Whether a failed request changed anything at the retailer.
 * `unknown` must never be retried blindly with a new operation ID.
 */
export const outcomeSchema = z.enum(['not_applied', 'applied', 'unknown']);
export type PluginOutcome = z.infer<typeof outcomeSchema>;

export const errorSchema = z.object({
  code: errorCodeSchema,
  message: z.string().max(1000),
  retryable: z.boolean(),
  outcome: outcomeSchema,
});
export type PluginError = z.infer<typeof errorSchema>;

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

export const requestEnvelopeSchema = z.object({
  v: z.literal(PROTOCOL_VERSION),
  kind: z.literal('req'),
  id: z.string().min(1).max(64),
  method: z.string().min(1).max(64),
  params: z.unknown(),
});

export const responseEnvelopeSchema = z.union([
  z.object({
    v: z.literal(PROTOCOL_VERSION),
    kind: z.literal('res'),
    id: z.string().min(1).max(64),
    ok: z.literal(true),
    result: z.unknown(),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION),
    kind: z.literal('res'),
    id: z.string().min(1).max(64),
    ok: z.literal(false),
    error: errorSchema,
  }),
]);

export const eventEnvelopeSchema = z.object({
  v: z.literal(PROTOCOL_VERSION),
  kind: z.literal('evt'),
  event: z.string().min(1).max(64),
  data: z.unknown(),
});

export const envelopeSchema = z.union([requestEnvelopeSchema, responseEnvelopeSchema, eventEnvelopeSchema]);
export type RequestEnvelope = z.infer<typeof requestEnvelopeSchema>;
export type ResponseEnvelope = z.infer<typeof responseEnvelopeSchema>;
export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;
export type Envelope = z.infer<typeof envelopeSchema>;

// ---------------------------------------------------------------------------
// Handshake (plugin -> core)
// ---------------------------------------------------------------------------

export const helloParamsSchema = z.object({
  pluginName: shortText,
  pluginVersion: z.string().min(1).max(64),
  providerId: providerIdSchema,
  providerLabel: shortText,
  /** Stable opaque hash of the retailer account, or null while unauthenticated. */
  accountKey: z.string().min(8).max(128).nullable(),
  accountLabel: z.string().max(200).nullable(),
  protocolVersions: z.array(z.number().int().positive()).min(1).max(16),
  capabilities: z.array(capabilitySchema).max(32),
  /** Optional capability additions such as `list.notes`; absent in older plugins. */
  features: z.array(featureNameSchema).max(32).optional(),
  authState: authStateSchema,
});
export type HelloParams = z.infer<typeof helloParamsSchema>;

export const welcomeResultSchema = z.object({
  protocolVersion: z.number().int().positive(),
  sessionId: identifier,
  installationId: identifier,
  coreVersion: z.string().max(64),
});
export type WelcomeResult = z.infer<typeof welcomeResultSchema>;

// ---------------------------------------------------------------------------
// Authentication relay (core -> plugin)
// ---------------------------------------------------------------------------

export const authFieldSchema = z.object({
  name: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/),
  label: shortText,
  type: z.enum(['text', 'password', 'email', 'code']),
  required: z.boolean(),
  /** Secret values are relayed once and never stored or logged by core. */
  secret: z.boolean(),
});
export type AuthField = z.infer<typeof authFieldSchema>;

export const authStepSchema = z.object({
  stepId: identifier,
  kind: z.enum(['form', 'link', 'done', 'error']),
  title: shortText,
  message: longText.optional(),
  url: httpsUrlSchema.optional(),
  fields: z.array(authFieldSchema).max(20).optional(),
});
export type AuthStep = z.infer<typeof authStepSchema>;

export const authBeginParamsSchema = z.object({});
export const authSubmitParamsSchema = z.object({
  stepId: identifier,
  values: z.record(z.string().max(40), z.string().max(4096)),
});
export const authLogoutParamsSchema = z.object({});

// ---------------------------------------------------------------------------
// Catalog (core -> plugin)
// ---------------------------------------------------------------------------

/**
 * Whether the retailer still sells a product. Only report `discontinued` when
 * the retailer says so explicitly: a product missing from search results is
 * never discontinued. Omitted means `unknown`. Values this core does not know
 * are read as omitted, so the list can grow without breaking older cores.
 */
export const PRODUCT_AVAILABILITY = ['available', 'temporarily_unavailable', 'discontinued', 'unknown'] as const;
export const productAvailabilitySchema = z.enum(PRODUCT_AVAILABILITY);
export type ProductAvailability = z.infer<typeof productAvailabilitySchema>;

export const retailerProductSchema = z.object({
  id: identifier,
  name: shortText,
  brand: z.string().max(200).optional(),
  gtins: z.array(z.string().regex(/^[0-9]{8,14}$/)).max(20).optional(),
  /** Amount in one sellable package, for example 500 with packageUnit "g". */
  packageAmount: z.number().positive().finite().optional(),
  packageUnit: z.string().max(32).optional(),
  /** `weight` products are sold by weight; receipt quantities are then weights. */
  measure: z.enum(['unit', 'weight']),
  availability: productAvailabilitySchema.optional().catch(undefined),
});
export type RetailerProduct = z.infer<typeof retailerProductSchema>;

export const catalogSearchParamsSchema = z.object({ query: z.string().min(1).max(200) });
export const catalogSearchResultSchema = z.object({ products: z.array(retailerProductSchema) });
export const catalogGetParamsSchema = z.object({ ids: z.array(identifier).min(1).max(200) });
export const catalogGetResultSchema = z.object({ products: z.array(retailerProductSchema) });

// ---------------------------------------------------------------------------
// Shared shopping list (core -> plugin)
// ---------------------------------------------------------------------------

export const listLineSchema = z.object({
  lineId: identifier,
  retailerProductId: identifier.nullable(),
  description: z.string().max(500),
  quantity: z.number().int().nonnegative(),
});
export type ListLine = z.infer<typeof listLineSchema>;

export const shopListSchema = z.object({
  listId: identifier,
  lines: z.array(listLineSchema),
});
export type ShopList = z.infer<typeof shopListSchema>;

export const listReadParamsSchema = z.object({});
export const listReadResultSchema = shopListSchema;

/** Free-text note on a shared list. Plugins encode amounts in the text; a note has no quantity of its own. */
export const noteTextSchema = z.string().min(1).max(200)
  .refine(value => value.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(value), 'Notes are single-line, non-empty text');

export const listOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('add'),
    retailerProductId: identifier,
    quantity: z.number().int().positive(),
  }),
  z.object({
    op: z.literal('set'),
    lineId: identifier,
    quantity: z.number().int().positive(),
    /** The operation only applies when the line still has this quantity. */
    expectedQuantity: z.number().int().nonnegative(),
  }),
  z.object({
    op: z.literal('remove'),
    lineId: identifier,
    expectedQuantity: z.number().int().nonnegative(),
  }),
  /**
   * Requires the `list.notes` feature. Adds one free-text note. The result is
   * `conflict` (reason `note_exists`) when a note with the same text, compared
   * case-insensitively after trimming, already exists: it is never adopted.
   */
  z.object({
    op: z.literal('add_note'),
    text: noteTextSchema,
  }),
  /** Requires the `list.notes` feature. Only applies while the line is still a note with `expectedText`. */
  z.object({
    op: z.literal('remove_note'),
    lineId: identifier,
    expectedText: noteTextSchema,
  }),
]);
export type ListOp = z.infer<typeof listOpSchema>;

export const listApplyParamsSchema = z.object({
  /** Idempotency key: a repeated opId must return the cached result without re-applying. */
  opId: z.string().min(8).max(64),
  listId: identifier,
  ops: z.array(listOpSchema).min(1),
});
export type ListApplyParams = z.infer<typeof listApplyParamsSchema>;

/**
 * Machine-readable detail for a `failed` or `conflict` op result.
 * - `product_discontinued`: the retailer definitively refuses the product
 *   because it is no longer sold (only with `failed`).
 * - `product_temporarily_unavailable`: the product cannot be listed right now.
 * - `note_exists`: an `add_note` found a note with the same text.
 * Unknown values are read as omitted.
 */
export const LIST_OP_REASONS = ['product_discontinued', 'product_temporarily_unavailable', 'note_exists'] as const;
export const listOpReasonSchema = z.enum(LIST_OP_REASONS);
export type ListOpReason = z.infer<typeof listOpReasonSchema>;

export const listOpResultSchema = z.object({
  index: z.number().int().nonnegative(),
  status: z.enum(['applied', 'conflict', 'failed']),
  lineId: identifier.optional(),
  message: z.string().max(500).optional(),
  reason: listOpReasonSchema.optional().catch(undefined),
});
export type ListOpResult = z.infer<typeof listOpResultSchema>;

export const listApplyResultSchema = z.object({
  opId: z.string().min(8).max(64),
  results: z.array(listOpResultSchema),
  list: shopListSchema,
});
export type ListApplyResult = z.infer<typeof listApplyResultSchema>;

// ---------------------------------------------------------------------------
// Receipts (core -> plugin)
// ---------------------------------------------------------------------------

export const receiptSummarySchema = z.object({
  receiptId: identifier,
  purchasedAt: isoDateTime,
  lineCount: z.number().int().nonnegative(),
});
export type ReceiptSummary = z.infer<typeof receiptSummarySchema>;

export const receiptsListParamsSchema = z.object({
  since: isoDateTime,
  cursor: z.string().max(512).optional(),
});
export const receiptsListResultSchema = z.object({
  receipts: z.array(receiptSummarySchema),
  nextCursor: z.string().max(512).nullable().optional(),
});

export const receiptLineSchema = z.object({
  lineNo: z.number().int().nonnegative(),
  kind: z.enum(['product', 'deposit', 'discount', 'fee', 'other']),
  retailerProductId: identifier.optional(),
  gtin: z.string().regex(/^[0-9]{8,14}$/).optional(),
  description: z.string().max(500),
  /** Packages for `unit` products, the weight in `unit` for weighed products. */
  quantity: z.number().finite(),
  unit: z.string().max(32),
  unitPriceCents: z.number().int().optional(),
  amountCents: z.number().int().optional(),
});
export type ReceiptLine = z.infer<typeof receiptLineSchema>;

export const receiptSchema = z.object({
  receiptId: identifier,
  purchasedAt: isoDateTime,
  storeLabel: z.string().max(200).optional(),
  totalCents: z.number().int().optional(),
  lines: z.array(receiptLineSchema),
});
export type Receipt = z.infer<typeof receiptSchema>;

export const receiptsGetParamsSchema = z.object({ receiptId: identifier });
export const receiptsGetResultSchema = receiptSchema;

// ---------------------------------------------------------------------------
// Method and event registries
// ---------------------------------------------------------------------------

/** Methods core calls on the plugin. */
export const pluginMethods = {
  'auth.begin': { params: authBeginParamsSchema, result: authStepSchema, capability: 'auth' },
  'auth.submit': { params: authSubmitParamsSchema, result: authStepSchema, capability: 'auth' },
  'auth.logout': { params: authLogoutParamsSchema, result: authStepSchema, capability: 'auth' },
  'catalog.search': { params: catalogSearchParamsSchema, result: catalogSearchResultSchema, capability: 'catalog' },
  'catalog.get': { params: catalogGetParamsSchema, result: catalogGetResultSchema, capability: 'catalog' },
  'list.read': { params: listReadParamsSchema, result: listReadResultSchema, capability: 'list' },
  'list.apply': { params: listApplyParamsSchema, result: listApplyResultSchema, capability: 'list' },
  'receipts.list': { params: receiptsListParamsSchema, result: receiptsListResultSchema, capability: 'receipts' },
  'receipts.get': { params: receiptsGetParamsSchema, result: receiptsGetResultSchema, capability: 'receipts' },
} as const;
export type PluginMethod = keyof typeof pluginMethods;
export type PluginMethodParams<M extends PluginMethod> = z.input<(typeof pluginMethods)[M]['params']>;
export type PluginMethodResult<M extends PluginMethod> = z.output<(typeof pluginMethods)[M]['result']>;

/** Methods the plugin calls on core. */
export const coreMethods = {
  hello: { params: helloParamsSchema, result: welcomeResultSchema },
} as const;
export type CoreMethod = keyof typeof coreMethods;

/** Events are hints only. Core always re-reads durable state before acting. */
export const pluginEvents = {
  'auth.changed': z.object({
    authState: authStateSchema,
    accountKey: z.string().min(8).max(128).nullable(),
    accountLabel: z.string().max(200).nullable(),
  }),
  'list.changed': z.object({ listId: identifier.optional() }),
  'receipts.available': z.object({ count: z.number().int().nonnegative().optional() }),
} as const;
export type PluginEvent = keyof typeof pluginEvents;
export type PluginEventData<E extends PluginEvent> = z.infer<(typeof pluginEvents)[E]>;

export function isPluginMethod(method: string): method is PluginMethod {
  return Object.prototype.hasOwnProperty.call(pluginMethods, method);
}

export function isPluginEvent(event: string): event is PluginEvent {
  return Object.prototype.hasOwnProperty.call(pluginEvents, event);
}

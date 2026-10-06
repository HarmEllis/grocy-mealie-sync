# Shop plugin protocol v1

The source of truth is `src/lib/plugins/protocol/v1.ts` (zod schemas). It is
vendored verbatim into the plugin template; a core test fails when the copies
drift (`npm run plugins:sync-protocol` updates the copy).

## Connection

- `GET /api/plugins/connect` on the same host and port as the web app, upgraded
  to a WebSocket.
- Headers: `Authorization: Bearer gmsp_<installationId>_<secret>` and
  `Sec-WebSocket-Protocol: gms-plugin.v1`. Requests with an `Origin` header are
  refused.
- Handshake failures are plain HTTP responses: `401` (invalid or revoked
  token), `403` (browser origin), `400` (missing subprotocol), `503` with
  `Retry-After` (this instance does not own the scheduler, or it is still
  starting) and `429` with `Retry-After` (too many failed handshakes).
  Plugins reconnect with exponential backoff and jitter.
- Frames are JSON text, at most 2 MiB, no compression. Core pings every 30
  seconds. At most 8 requests are in flight per direction.

## Envelope

```json
{ "v": 1, "kind": "req", "id": "…", "method": "…", "params": {} }
{ "v": 1, "kind": "res", "id": "…", "ok": true, "result": {} }
{ "v": 1, "kind": "res", "id": "…", "ok": false, "error": { "code": "…", "message": "…", "retryable": false, "outcome": "not_applied" } }
{ "v": 1, "kind": "evt", "event": "…", "data": {} }
```

`outcome` says whether a failed request changed anything at the retailer:
`not_applied`, `applied` or `unknown`. Core never retries `unknown` with a
new operation ID.

## Handshake

The plugin sends `hello` first, within 10 seconds:

| Field | Meaning |
| --- | --- |
| `pluginName`, `pluginVersion` | Free text shown in the UI |
| `providerId`, `providerLabel` | Retailer slug (for example `demo-shop`); an installation is bound to its first provider |
| `accountKey`, `accountLabel` | Stable opaque hash of the retailer account, or `null` while signed out; an installation is bound to its first account |
| `protocolVersions` | Must contain `1` |
| `capabilities` | `auth`, `catalog`, `list`, `receipts` (reserved: `cart`, `order`, `slots`, `quote`, `promotions`) |
| `authState` | `authenticated`, `unauthenticated`, `expired` or `unknown` |

Core answers `welcome { protocolVersion, sessionId, installationId, coreVersion }`.
A newer session of the same installation supersedes the older one (close code
4000).

## Methods called by core

| Method | Params | Result |
| --- | --- | --- |
| `auth.begin` | `{}` | `AuthStep` |
| `auth.submit` | `{ stepId, values }` | `AuthStep` |
| `auth.logout` | `{}` | `AuthStep` |
| `catalog.search` | `{ query }` | `{ products: RetailerProduct[] }` |
| `catalog.get` | `{ ids }` | `{ products: RetailerProduct[] }` |
| `list.read` | `{}` | `{ listId, lines[{ lineId, retailerProductId, description, quantity }] }` |
| `list.apply` | `{ opId, listId, ops[] }` | `{ opId, results[{ index, status, lineId?, message? }], list }` |
| `receipts.list` | `{ since, cursor? }` | `{ receipts[{ receiptId, purchasedAt, lineCount }], nextCursor? }` |
| `receipts.get` | `{ receiptId }` | `{ receiptId, purchasedAt, storeLabel?, totalCents?, lines[] }` |

- `AuthStep`: `{ stepId, kind: form|link|done|error, title, message?, url? (https only), fields?[{ name, label, type, required, secret }] }`.
- `RetailerProduct`: `{ id, name, brand?, gtins?, packageAmount?, packageUnit?, measure: unit|weight }`.
- `list.apply` ops: `add { retailerProductId, quantity }`,
  `set { lineId, quantity, expectedQuantity }`,
  `remove { lineId, expectedQuantity }`. A `set` or `remove` only applies
  when the line still has `expectedQuantity`; otherwise the result is
  `conflict`. Per-op `failed` guarantees nothing was written for that op.
  A repeated `opId` must return the cached result without applying again;
  core re-sends the same `opId` after an uncertain answer and only accepts a
  reply with the same `opId`, `listId` and exactly one result per op.
- Receipt lines: `{ lineNo, kind: product|deposit|discount|fee|other,
  retailerProductId?, gtin?, description, quantity, unit, unitPriceCents?,
  amountCents? }`. For `measure: unit` products `quantity` counts packages; for
  weighed products it is a weight in `unit`.

## Events sent by the plugin

Events are hints only; core always re-reads durable state.

| Event | Data |
| --- | --- |
| `auth.changed` | `{ authState, accountKey, accountLabel }` |
| `list.changed` | `{ listId? }` |
| `receipts.available` | `{ count? }` |

## Close codes

| Code | Meaning |
| --- | --- |
| 1001 | Core shutting down |
| 1012 | Instance no longer owns the scheduler, or binding reset |
| 4000 | Superseded by a newer session |
| 4001 | Token revoked or rotated |
| 4003 | Invalid hello |
| 4006 | Unsupported protocol version |
| 4008 | No hello in time |
| 4009 | Provider or retailer account does not match the installation |

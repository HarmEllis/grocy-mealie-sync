# grocy-mealie-sync shop plugin template

A standalone, public-safe starter for an external shop plugin. The included retailer is entirely synthetic. Real shop APIs and credentials do not belong in this template or gm-sync core.

The container opens one authenticated WebSocket connection to gm-sync's existing host and port at `/api/plugins/connect`. It has no web interface, inbound port, direct Mealie access or direct Grocy access. gm-sync owns account-linking forms, product matching, conversions, list ownership and purchase reconciliation.

## Run

Use Node.js 24. Create a plugin installation in gm-sync's **Plugins** screen and copy its token once. Set `GM_SYNC_URL` to the existing gm-sync URL and `GM_SYNC_PLUGIN_TOKEN` to that token in your container environment, then run `docker compose up --build -d`. Mount `/data` persistently. The existing reverse proxy must allow WebSocket upgrades on this path; no extra hostname or port is required.

For local development, run `npm ci`, `npm test`, `npm run typecheck` and `npm start`. Set `PLUGIN_DATA_DIR` to a writable directory when not using Docker. In gm-sync, connect the synthetic account with a stable account label and code `demo`. The label is bound to this volume; use a fresh installation and volume for another account. `DEMO_AUTHENTICATED=true` is available for synthetic integration tests only.

The demo catalogue contains `demo-milk` (1 litre), `demo-rice` (500 grams) and `demo-apples` (weighed). The list is persisted in `/data/state.json`. To simulate a purchase, write an array of protocol-valid receipt objects to `/data/receipts.json`, then request a receipt pull in gm-sync. Fixtures must be synthetic. Enable automation and confirm product/unit mappings in gm-sync before testing list projection or receipt processing.

## Build a shop adapter

Replace `src/demo.ts` and instantiate your adapter in `src/main.ts`. Keep `lib/client.ts`, `lib/operations.ts`, `lib/errors.ts` and `lib/protocol/v1.ts` reusable. Implement `ShopAdapter.getManifest()` and `ShopAdapter.handle(method, params)`; the runtime validates all input and output against the wire contract. The manifest uses a stable provider slug, stable opaque account key and capability list. Keep retailer IDs as strings and distinguish POS product IDs from catalogue IDs explicitly.

`PluginClient` handles bearer authentication, handshake, reconnect with jitter, request concurrency, schema validation, heartbeat health and event notifications. Call `client.notify('receipts.available', { count })` or `client.notify('list.changed', { listId })` for hints; gm-sync performs a durable read afterward. Authentication operations returning `kind: 'done'` automatically emit `auth.changed` from the current manifest.

Render account linking through `auth.begin/submit/logout` results. Put only safe labels and messages in forms and `AdapterError`; never include raw upstream responses, access tokens, passwords or login codes in logs/errors. Store retailer credentials solely in `/data`, with restrictive file permissions. The gm-sync installation token belongs in the plugin environment; rotate/revoke it through gm-sync.

`list.apply` has a durable `opId` cache. Intent is persisted before invoking the adapter. Completed operations replay their result; interrupted writes remain uncertain and never execute blindly after restart. Validate expected quantities immediately before writes. Each response must confirm the same list, operation ID and exactly one result for every index. Per-operation `failed` or `conflict` means no change occurred for that operation. If a write may have happened, throw `AdapterError` with `outcome: 'unknown'`; resolve it explicitly in gm-sync using retailer evidence before sending a new operation.

Fixed package mappings express base amount per package. Weight mappings express base amount per kilogram; report receipt units accurately (`kg`, `g`) so core can convert them. Unknown IDs, weights and conversions must remain unknown. Deposits, discounts, fees and returns must retain their own line kinds rather than being transformed into ordinary products.

## Contract maintenance

In the gm-sync repository, `npm run plugins:sync-protocol` copies the single-source contract into this template; `npm run plugins:sync-protocol -- --check` checks drift. When extracting this folder into its own repository, pin the corresponding gm-sync protocol release. The standalone contract tests use synthetic data and an actual outbound WebSocket connection.

Online-cart, order, delivery-slot, quote and promotion capabilities are reserved for future protocol extensions. Core v1 implements catalogue, shared shopping lists and receipts. Put proprietary or unofficial shop implementations in separate private repositories and publish only this generic template if desired.

## Releases and container images

See [RELEASING.md](RELEASING.md) for stable releases, prereleases and CI-gated image publication.

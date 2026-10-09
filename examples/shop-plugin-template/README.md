# grocy-mealie-sync shop plugin template

A standalone, public-safe starter for an external shop plugin. The included retailer is entirely synthetic. Real shop APIs and credentials do not belong in this template or gm-sync core.

The container opens one authenticated WebSocket connection to gm-sync's existing host and port at `/api/plugins/connect`. It has no web interface, inbound port, direct Mealie access or direct Grocy access. gm-sync owns account-linking forms, product matching, conversions, list ownership and purchase reconciliation.

## Run

Use the synthetic retailer with a test gm-sync instance; do not map demo receipts
to production products or stock. A host Node.js installation is needed only for
local development (Node.js 24); Docker builds include the runtime.

1. Create a plugin installation under gm-sync's **Settings → Shop plugins** and
   copy its token, which is shown only once.
2. In this template directory, create `.env` for Compose interpolation:

   ```dotenv
   GM_SYNC_URL=https://gm-sync.example.com
   GM_SYNC_PLUGIN_TOKEN=replace-with-the-installation-token
   ```

   Restrict its permissions (`chmod 600 .env`) and keep it out of version control.
   The URL may use HTTP(S) or WS(S); `/api/plugins/connect` is appended
   automatically. Credentials embedded in URLs are rejected.
3. Run `docker compose up --build -d`. The bundled `compose.yaml` persists `/data`.
   Its Docker healthcheck reads `/data/heartbeat`; a recent heartbeat indicates a
   live gm-sync connection.
4. Wait for the connected badge in gm-sync, then click **Retailer sign-in**.
   Use a stable synthetic account label and code `demo`. The label is bound to
   this volume; use a fresh installation and volume for another account.

The URL must be reachable from the plugin container. An internal URL such as
`http://grocy-mealie-sync:3000` works only on a shared Docker network; separate
Compose projects do not share their default network. The reverse proxy must
allow WebSocket upgrades with an idle timeout above the 30-second heartbeat.
No extra hostname or published plugin port is required. See gm-sync's
[networking guide](https://github.com/HarmEllis/grocy-mealie-sync#networking)
and [plugin troubleshooting](https://github.com/HarmEllis/grocy-mealie-sync/blob/main/docs/shop-plugins.md#troubleshooting).

### Local development

Run `npm ci`, `npm test` and `npm run typecheck`. Start with the connection settings
and a writable data directory (plain `npm start` does not load the Compose `.env`).
After the `read` command, paste the plugin token and press Enter:

```bash
export GM_SYNC_URL=http://localhost:3000
read -r GM_SYNC_PLUGIN_TOKEN
export GM_SYNC_PLUGIN_TOKEN
PLUGIN_DATA_DIR=./.data npm start
```

Keep `.data` out of version control. `DEMO_AUTHENTICATED=true` is available for
synthetic integration tests only.

### Test lists and receipts

The demo catalogue contains `demo-milk` (1 litre), `demo-rice` (500 grams) and
`demo-apples` (weighed). The list is persisted in `/data/state.json`. Confirm
product/unit mappings and enable **Sync shared shopping list** before testing
projection from Mealie.

To simulate a purchase, enable **Process receipts** first, then write an array
of synthetic receipt objects to `/data/receipts.json`. Each `purchasedAt` must
be after that activation moment; older purchases are reference-only and book
no stock. Use **Pull receipts now** under **Shopping → Receipts**; reconciliation
follows in the next scheduled sync. See the `receiptSchema` in
[lib/protocol/v1.ts](lib/protocol/v1.ts) and the fixture in
[test/contract.mjs](test/contract.mjs) for the required fields.

## Build a shop adapter

Replace `src/demo.ts` and instantiate your adapter in `src/main.ts`. Keep `lib/client.ts`, `lib/operations.ts`, `lib/errors.ts` and `lib/protocol/v1.ts` reusable. Implement `ShopAdapter.getManifest()` and `ShopAdapter.handle(method, params)`; the runtime validates all input and output against the wire contract. The manifest uses a stable provider slug, stable opaque account key and capability list. Keep retailer IDs as strings and distinguish POS product IDs from catalogue IDs explicitly.

`PluginClient` handles bearer authentication, handshake, reconnect with jitter, request concurrency, schema validation, heartbeat health and event notifications. Call `client.notify('receipts.available', { count })` or `client.notify('list.changed', { listId })` for hints; gm-sync performs a durable read afterward. Authentication operations returning `kind: 'done'` automatically emit `auth.changed` from the current manifest.

Render account linking through `auth.begin/submit/logout` results. Put only safe labels and messages in forms and `AdapterError`; never include raw upstream responses, access tokens, passwords or login codes in logs/errors. Store retailer credentials solely in `/data`, with restrictive file permissions. The gm-sync installation token belongs in the plugin environment; rotate/revoke it through gm-sync.

`list.apply` has a durable `opId` cache. Intent is persisted before invoking the adapter. Completed operations replay their result; interrupted writes remain uncertain and never execute blindly after restart. Validate expected quantities immediately before writes. Each response must confirm the same list, operation ID and exactly one result for every index. Per-operation `failed` guarantees no write occurred. A `conflict` means the observed state prevents a verified owned change; after interrupted writes it does not prove that an earlier write never happened. If a write may have happened, throw `AdapterError` with `outcome: 'unknown'`; resolve it explicitly in gm-sync using retailer evidence before sending a new operation.

An adapter may implement the optional `reconcileListApply(params)`. When a `list.apply` with the same `opId` was interrupted, the runtime calls it instead of executing again. Return a complete result only when retailer evidence safely settles every op without claiming uncertain ownership (report ops that were never attempted as `failed`); return `null` to keep the operation uncertain. Evidence must never hand a household note to gm-sync: after an uncertain `add_note`, a listed note with that text may be the user's, so report `conflict` with `note_exists` (never `applied`), and an absent note proves nothing because the write may still land. After an uncertain `remove_note`, only an absent note settles it.

Report product availability with the optional `availability` field (`available`, `temporarily_unavailable`, `discontinued`, `unknown`). Only report `discontinued` when the retailer says so explicitly; a product missing from search results is never discontinued. When the retailer definitively refuses to list a product because it is no longer sold, answer that `add` op with `status: 'failed'` and `reason: 'product_discontinued'`; use `product_temporarily_unavailable` for a temporary refusal.

Free-text notes are opt-in: add `features: ['list.notes']` to the manifest and handle `add_note { text }` and `remove_note { lineId, expectedText }`. gm-sync uses a note for a discontinued product or a manual per-account text fallback, with the amount in the text. Never adopt an existing note: answer `add_note` with `conflict` and `reason: 'note_exists'` when a note with the same text (trimmed, case-insensitive) exists, and only remove a note that still matches `expectedText` after whitespace normalization and case folding. Note line IDs must stay stable across reads. Plugins without the feature keep working; gm-sync then shows the discontinued product for review instead.

Fixed package mappings express base amount per package. Weight mappings express base amount per kilogram; report receipt units accurately (`kg`, `g`) so core can convert them. Unknown IDs, weights and conversions must remain unknown. Deposits, discounts, fees and returns must retain their own line kinds rather than being transformed into ordinary products.

## Contract maintenance

In the gm-sync repository, `npm run plugins:sync-protocol` copies the single-source contract into this template; `npm run plugins:sync-protocol -- --check` checks drift. When extracting this folder into its own repository, pin the corresponding gm-sync protocol release. The standalone contract tests use synthetic data and an actual outbound WebSocket connection.

Online-cart, order, delivery-slot, quote and promotion capabilities are reserved for future protocol extensions. Core v1 implements catalogue, shared shopping lists and receipts. Put proprietary or unofficial shop implementations in separate private repositories and publish only this generic template if desired.

## Releases and container images

See [RELEASING.md](RELEASING.md) for stable releases, prereleases and CI-gated image publication.

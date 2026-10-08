# Shop plugins

Shop plugins connect grocy-mealie-sync to retailers: a shared shopping list on
the retailer side, and digital receipts that are reconciled with Grocy stock
and the Mealie shopping list. All decisions, mappings and the user interface
live in grocy-mealie-sync. A plugin only talks to its retailer.

Without plugin installations nothing changes: the scheduler runs exactly the
same steps as before, and the plugin runtime does no work.

## Architecture

- **No inbound port, no web UI.** A plugin runs in its own container and opens
  a WebSocket to grocy-mealie-sync on the **same host and port** as the web app,
  path `/api/plugins/connect`. The custom server (`server.mjs`) routes that
  upgrade to the plugin gateway; everything else is served by Next.js. Dev mode
  HMR keeps working on the same port.
- **Tokens per installation.** Create an installation under *Settings → Shop
  plugins*. The token is shown once, stored only as a SHA-256 hash, and can be
  rotated or revoked; revoking closes the live session immediately. Plugin
  authentication is independent of app login (`AUTH_ENABLED`). Browser
  connections (any `Origin` header) are refused, and repeated failed
  handshakes are throttled per remote address.
- **Retailer credentials stay in the plugin.** Sign-in is declarative: the
  plugin describes form or link steps, grocy-mealie-sync renders them (plain
  text, https links only) and relays the values once. Nothing is stored or
  logged in grocy-mealie-sync. Retailer tokens live in the plugin's own volume.
- **Scheduler ownership.** The gateway accepts sessions only on the instance
  that owns the scheduler and closes them when it stops owning it. The shop
  worker (list sync, receipt pulls) and the reconciliation steps run on that
  same instance, so a connected plugin never sits on a passive instance.
- **Plugins never write to Grocy or Mealie.** Events from plugins are hints;
  every write is planned and executed by grocy-mealie-sync.

### Running a plugin

```yaml
services:
  shop-plugin:
    image: <shop plugin image>
    restart: unless-stopped
    environment:
      GM_SYNC_URL: http://grocy-mealie-sync:3000   # internal Docker network URL
      GM_SYNC_PLUGIN_TOKEN: <token shown once>
      PLUGIN_DATA_DIR: /data
    volumes:
      - shop-plugin-data:/data
volumes:
  shop-plugin-data:
```

Behind a reverse proxy, enable WebSocket upgrades for `/api/plugins/connect`
and use an idle timeout above the 30 second heartbeat. Prefer the internal
Docker network URL so the plugin does not leave the host.

The public [plugin template](https://github.com/HarmEllis/gms-shop-plugin-template)
(also vendored in `examples/shop-plugin-template`) contains a synthetic
demo shop, the reusable client runtime and a contract test suite. Build a real
retailer plugin by replacing only the adapter.

## Toggles and safety rails

Each installation has two toggles, both off by default:

- **Sync shared shopping list**: open Mealie demand is projected onto the
  retailer list.
- **Process receipts**: receipts are pulled and reconciled. Turning it on sets
  the activation boundary to "now"; receipts bought earlier are stored as
  reference-only lines and never booked. The boundary only moves forward.

Disabling receipt processing or revoking a plugin stops new receipt plans.
Existing ledger plans still settle so an applied Grocy booking receives its
dependent Mealie update. Unknown writes still require evidence or a decision;
they are never retried blindly. A retailer amendment stays flagged for review
while effects from the original receipt finish; amended contents are never
planned automatically.

Automatic processing also requires a **confirmed mapping** (with a confirmed
package amount in the target's current unit) for every retailer product.
Anything else goes to review on the *Shopping* page.

An installation is bound to the first retailer account and shopping list it
reports. A different account or list is refused until you use *Reset account
and list binding*. The reset forgets list ownership and **turns both toggles
off**, so a new account never inherits the old receipt activation boundary;
turning receipts on again moves the boundary to the moment you re-enable it.

## Automatic product proposals

With shared-list sync enabled, the next regular synchronization observes open
Mealie rows and queues a catalogue search for each ingredient without a preferred
retailer mapping. The plugin worker performs up to three searches per retailer
per worker pass (normally once per minute), outside the main synchronization lock. Grocy-linked ingredients use
the Grocy product name; Mealie-only ingredients use the food name supplied by the
shopping row. Sub-product rows are searched per child when no usable parent
mapping exists. Free-text rows without a food identity require manual mapping.

Under Shopping → Products, **Shopping ingredients to map** shows waiting searches,
results and failures. Search results create name-based proposals, never confirmed
mappings. Accept a proposal or use Map, then confirm the amount per package in
the target unit. Existing preferred mappings are reused. Search state survives
restarts and quantity changes; deleting and re-adding a Mealie row preserves its
product proposals and mapping. Rejected pairs remain rejected. Failed searches
retry with backoff; **Search again** also allows a manual retry. No-result searches
wait for a manual retry or catalogue search.

History records product names and quantities separately: a prepared shopping-list
plan is distinct from a list operation confirmed by the retailer plugin.

## Mappings

Mappings are kept per retailer (provider), shared by all installations of that
retailer:

- A retailer product maps to a **Grocy product** or, for items not tracked in
  Grocy, to a **Mealie food** ("Mealie only"). Mealie-only purchases only
  fulfil shopping rows; nothing is booked into Grocy.
- One **preferred** retailer product per target is used for the shared list.
  **Remembered alternatives** are only created when you tick "remember as
  alternative".
- The package amount is expressed in the target's base unit: the Grocy
  stock unit, or the chosen Mealie unit (empty means "count"). Weighed
  products are mapped per kilogram. Amounts can be derived automatically from
  catalogue data but are only used after you confirm them. When the Grocy stock
  unit of a target changes later, the mapping goes back to review.
- Suggestions are decided once; a rejected pair is never suggested again.

## Shared list ownership

grocy-mealie-sync only touches lines it created or adopted. When it adopts a
line that already existed, the existing quantity is the household's baseline
and is never removed. Units added by others raise the baseline. Because
quantities alone cannot tell whose units disappeared, any unexplained
reduction, missing line, duplicate line or reused line **pauses** that line.
The *Shopping* page then asks what happened: someone removed their own units,
add ours again, or release the line. A released line stays untouched until
new demand produces a newer export.

Demand is summed per retailer product in the base unit before rounding to
whole packages, so one package can serve several shopping rows. Every export
version is kept for later receipt attribution.

## Receipts and reconciliation

Receipts go through separate levels: an optional plugin hint, a durable pull
by grocy-mealie-sync (on connect, every 30 minutes, on hints and on demand,
from a persisted cursor with a two-day overlap), a stored receipt, planned
effects and applied effects. Receipts are deduplicated per retailer account,
so two installations of the same account never book a receipt twice. A
receipt that changes after it was stored goes to review instead of being
re-booked.

For each product line:

1. **Credits**: if a manual Mealie check already booked the same Grocy
   product for a row that was exported for this retailer product before the
   check and before the purchase, the receipt is credited against that
   booking instead of booking again. If the check booked more than the receipt
   shows, an over-booking discrepancy is raised with the transaction evidence.
2. **Exported demand** that existed at purchase time with the same food, unit
   and sub-products is fulfilled, oldest first. Rows added or changed after
   the purchase are never consumed by an older receipt.
3. **Other open demand** for the same target.
4. **Extras**: still booked into Grocy for Grocy targets.

Unknown, unmapped, returned or unit-mismatched lines go to review without
blocking the rest. A one-off substitution books only what was actually bought,
fulfils the chosen rows and raises a discrepancy when a manual check already
booked the original product.

Receipt bookings are recorded for the Grocy → Mealie low-stock sync, which then
does not reduce the same row a second time, while unrelated stock changes in
the same interval still produce their normal adjustments.

## Writes, uncertainty and the ledger

Every Grocy and Mealie write made for manual checks, receipts, substitutions
and corrections is an effect in a durable ledger. It is committed before the
HTTP call, and Grocy bookings carry a `[gms:<effect id>]` note marker.

- Only definitive failures (connection refused, client errors) are retried.
- Timeouts, dropped connections, server errors and crashes make an effect
  **unknown**. It is never retried automatically. grocy-mealie-sync looks for
  the note marker in Grocy's stock log; finding it proves the booking happened
  (a booking you undid in Grocy stays undone). Not finding it proves nothing,
  so the effect waits on the *Shopping* page for your decision: it happened,
  it did not happen (retry once), or skip.
- Mealie row reductions are compare-and-set: they only apply when the row
  still has the planned food, unit, sub-products and quantity. Any change by a
  person wins and the effect becomes superseded.
- While a Grocy booking is unknown, the low-stock sync freezes that product so
  the eventual outcome is accounted for exactly once.
- If you check off a row in Mealie while a receipt is still fulfilling that
  exact row, the check books nothing and asks whether it was an additional
  purchase.

Exactly-once delivery is impossible here: Grocy and Mealie offer no idempotency
keys, and there are no cross-system transactions. The guarantee is a single
attempt plus verification, with a human decision for what remains uncertain.
Late or missing receipts book nothing; manual checking keeps working as before.

## Limits

- Rows created by the low-stock sync carry stock amounts with the purchase unit
  label when purchase and stock units differ. Such rows are sent to review
  instead of being converted.
- Sub-product rows are matched to receipts through their single child or their
  parent product.
- Whether retailer list lines written through an API appear on a physical
  hand scanner depends on the retailer and must be checked per plugin.


## MCP control

Every Shop UI action is also exposed over the app's authenticated MCP endpoint.
`plugins.list` reads setup and connection state; `plugins.create`, `plugins.update`,
`plugins.rotate_token`, `plugins.revoke` and `plugins.reset_binding` manage the
installation. Creation and rotation return the new secret once; ordinary reads
never return it. `plugins.auth_begin`, `plugins.auth_submit` and
`plugins.auth_logout` relay the same sign-in forms and safe errors as the UI.
Keep entered sign-in values out of agent logs and source control.

Use `plugins.catalog_search`, `shop.mappings.list`, `shop.targets.search`,
`shop.mappings.save/update/delete`, `shop.suggestions.decide` and
`shop.searches.retry` for products and proposals. `shop.overview` reads all Shop
tabs, including receipt lines, ownership, pending effects and discrepancies.
`shop.lists.sync`, `shop.receipts.pull`, `shop.lines.resolve`,
`shop.review.resolve`, `shop.effects.resolve` and `shop.discrepancies.resolve`
perform the same validated, locked actions as the browser. An uncertain write
requires evidence and a deliberate resolution; MCP does not bypass these checks.

`history.list_activity` reads the product-level history shown in the UI, with
search, action, trigger, status, kind, date and pagination filters.
`history.list_runs` accepts the same run filters; `history.get_run` returns the
full ordered events. `history.status` reports history enablement and retention.
Date filters accept `YYYY-MM-DD` (whole days in server local time) or ISO timestamps.

## Mapping setup and recent receipts

The mapping dialog has one server-backed target search. Type any Grocy product
or Mealie ingredient name; initial suggestions are based on the retailer product name shown above the field,
with no brand-specific name stripping. Type a name to search directly. `(G+M)` identifies a linked Grocy/Mealie product and ranks first;
`(G)` and `(M)` identify standalone products. Linked Mealie results resolve to
one Grocy choice. The current choice remains selected when editing.

The package preview explains the stock amount per retailer package (per kg for
weighed products). It uses the same Mealie unit mappings and Grocy conversions
as demand projection. Catalogue-derived amounts remain proposals until the user
confirms them. Missing conversion paths for current demand link to Units &
Conversions. Mealie-only mappings use the selected Mealie unit or a count.

**Load receipts for setup** imports the latest 5 or 10 available receipts even
when processing is disabled. Receipt details and known product mappings are
visible, with direct mapping actions. Catalogue package details are fetched when
supported by the plugin. Historical imports never advance the processing cursor,
book stock or fulfil demand; enabling processing later does not promote them.
Existing active receipts retain their processing state. New receipts bought
after activation are left to the regular pull and reconciliation, even if setup
history is requested before the worker sees them. Legacy header-only
receipts can be hydrated by the setup import. Availability depends on what the
retailer retains and returns.

MCP uses the same handlers: `shop.targets.search` returns linked status and unit
metadata; `shop.mappings.preview` explains package derivation and conversion
paths; `shop.receipts.history` imports reference-only history and `shop.overview`
returns its complete lines and current mappings. The existing `mappings.*`,
`units.*` and `conversions.*` tools configure product/unit relationships. Use
`shop.mappings.save` to save and explicitly confirm a checked package amount.

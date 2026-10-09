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

The service name in this example resolves only when the plugin and gm-sync
share a Docker network. Separate Compose projects have separate default
networks; attach both services to a shared external network or use a reachable
LAN/proxy URL. See [Networking](../README.md#networking) for the network setup.

### Troubleshooting

Check the connection badge under **Settings → Shop plugins**, the plugin's
container logs, **Shopping → Diagnostics** and **History**.

| Symptom | What to check or do |
| --- | --- |
| Plugin stays offline | Check `GM_SYNC_URL` from the plugin container, the shared Docker network and proxy WebSocket upgrades. `localhost` identifies the plugin container itself. |
| Log says "Installation token rejected" | Check for an invalid/revoked token (HTTP 401) or a refused `Origin` header (HTTP 403). Rotate an invalid token, update the plugin environment and recreate the container; otherwise check the proxy headers. The template stops reconnecting after this rejection. |
| Log repeatedly says "Disconnected; reconnect scheduled" | Check DNS, the shared network, the URL and proxy upgrades. Possible causes also include handshake throttling (429), gm-sync startup or a passive instance (503), or a missing subprotocol (400). The template does not log the HTTP status; use gm-sync/proxy logs to distinguish these cases. Fix stale tokens before waiting for throttling to expire. |
| Container repeatedly restarts or never becomes healthy | Inspect `docker compose ps` and `docker compose logs shop-plugin`. Check required environment values, token rejection and revoked/superseded sessions before restarting with corrected settings. |
| Retailer sign-in is disabled | Wait for the connected badge. The plugin must advertise the `auth` capability for sign-in through gm-sync. |
| Installation token was lost | Rotate the token and update the plugin environment; the original token cannot be retrieved. |
| Plugin data volume was lost | Restore its backup if available. Otherwise sign in again to the same retailer account and review uncertain operations; restoring credentials alone cannot recreate a lost operation cache. |
| A different account or list is refused | Use **Reset account and list binding**, then sign in again. Reset turns both automation toggles off; review mappings and re-enable them explicitly. |

Use the template's synthetic demo on an isolated test instance to check the
connection and sign-in flow. Build it from the bundled source, or select an exact
version from the [template releases](https://github.com/HarmEllis/gms-shop-plugin-template/releases)
for image `ghcr.io/harmellis/gms-shop-plugin-template`. It is not a real retailer integration; do not map
synthetic purchases to production products or stock.

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
and list binding*. The reset signs out a connected plugin before clearing its
binding. A failed sign-out keeps the binding intact. Start a fresh login after
the reset. Disconnected plugins can still be reset to recover a refused account
change; a warning explains that their current sign-in will bind on reconnect.
To change accounts from within gm-sync, reset while the plugin is connected.
The reset forgets list ownership and **turns both toggles off**, so a new account
never inherits the old receipt activation boundary; turning receipts on again
moves the boundary to the moment you re-enable it.

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

Shopping → Overview and Review show why an open Mealie row was not sent to a
retailer, including missing mappings, unconfirmed package amounts and unit
conversion problems. Product names are retained from the observed Mealie rows,
including ingredients without a Grocy mapping. New blocking reasons for mapped
products also appear as shopping issues in History. Rows without a retailer
mapping or ingredient stay visible here without adding History issues or Review
attention counts.

Shopping → Diagnostics shows the last list sync, receipt checks and the managed,
household and desired quantities on each tracked retailer line. List read errors,
refused writes and receipt retrieval errors are recorded in History. An identical
unresolved error is not recorded again every minute; it is recorded again if it
returns after a successful attempt. History retention settings still apply.
MCP exposes the same issues through `history.list_activity` with `kind: "issue"`,
and current list sync results and blocked rows through `shop.overview`.

## Mappings

A Mealie row with quantity zero (no amount) and no unit requests one retailer
package when its mapping and package amount are confirmed. Projection and receipt
matching use the same package amount. Explicit quantities retain their normal
unit conversion. Products sold by weight require a quantity and unit.

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
- Saving a mapping always uses the target's current unit: the Grocy stock unit
  from Grocy, or an existing Mealie unit. An amount can only be confirmed in
  that unit; a mapping saved with an outdated unit is stored unconfirmed with
  the current unit and a warning. Saving the same target and unit again keeps
  an existing confirmation. Confirming without an amount only works when the
  package size converts exactly.

## Own product inventory

`GET /api/shop/products` (MCP `shop.products.list`) lists your own products,
one canonical row per Grocy product (with its linked Mealie food) or Mealie-only
food, with their retailer mappings. Filters: `source` (`all`, `grocy_mealie`,
`grocy`, `mealie`), `mapped` (`all`, `mapped`, `unmapped`), `query`,
`providerId`, `offset` and `limit` (at most 200). Grocy and Mealie data come
from a 30 second snapshot (`refresh=true` bypasses it); mappings are always
read fresh. A legacy preferred mapping on a Mealie food that is linked to a
Grocy product is shown on the Grocy row without changing its unit; moving it
to the Grocy product requires confirming the amount in the Grocy stock unit.

## Product availability

Every stored retailer product has an availability (`available`,
`temporarily_unavailable`, `discontinued` or `unknown`) and the time it was
last reported. Only an explicit statement from the plugin changes it: a
product that disappears from search results keeps its last known value, and
results without availability never erase stored package or availability data.

Before a mapping is saved, unknown or stale availability (older than six
hours) is refreshed with `catalog.get` when a signed-in plugin is connected.
Without a plugin the stored value is used and returned as `unknown` when
nothing is known, so known products can still be mapped offline. A product
reported as discontinued cannot get a new mapping, be pointed at another
target or become preferred. Existing mappings keep working with a warning.
Mapping responses return `{ mapping, availability, warnings }`.

Catalogue search (`GET /api/plugins/installations/:id/catalog?query=`) returns
live plugin results first, then stored products matching the query, each with
`availability`, `availabilityCheckedAt`, `live` and `saved`. `status` is
`live`, `cached` (a live result younger than one minute for the same plugin
session and retailer account; `refresh=1` bypasses it) or `offline` (stored
products only, with a `message`). Identical concurrent searches share one
plugin call. `POST /api/plugins/installations/:id/catalog/refresh` with
`{ ids }` re-reads products with `catalog.get`; IDs the plugin does not return
are listed as `missing` and keep their stored values.

## Shared list ownership

grocy-mealie-sync only touches lines it created or adopted. When it adopts a
line that already existed, the existing quantity is the household's baseline
and is never removed. Units added by others raise the baseline. Because
quantities alone cannot tell whose units disappeared, any unexplained
reduction, duplicate line or reused line **pauses** that line.
The *Shopping* page then asks what happened: someone removed their own units,
add ours again, or release the line. A released line stays untouched until
new demand produces a newer export.

If a managed product line is deleted in the retailer app, the next sync
restores the packages still needed by Mealie. Deleted household quantities
are not restored. Existing “line disappeared” pauses recover automatically.
To stop sending a product, remove it from Mealie or update your stock so it
is no longer needed. Missing lines with no remaining demand are forgotten.

Demand is summed per retailer product in the base unit before rounding to
whole packages, so one package can serve several shopping rows. Every export
version is kept for later receipt attribution.

### Discontinued products and notes

The shared list never substitutes another product on its own. A temporarily
unavailable product stays on the list as itself. When the retailer reports a
mapped product as discontinued, either in the catalogue or by definitively
refusing to add it (`product_discontinued`), the list carries one free-text
note instead, written from the target's own name and open amount, for example
`Kipfilet — 500 g`. Network errors, timeouts and unknown outcomes never cause
a note; the uncertain operation stays pending and is replayed with the same
operation ID.

- Some retailers never report a product as gone. For those, a preferred
  product can be shown as a note by hand: `POST /api/shop/lists/fallback`
  with `{ installationId, retailerProductId, mode: 'note' | 'product' }`. The
  choice is stored for that installation and its bound retailer account only,
  never on the shared catalogue product, and a binding reset forgets it. It
  needs a plugin with `list` and `list.notes` and a preferred mapping; a
  product the retailer reports as discontinued cannot be switched back to
  `product`. The request writes nothing itself: the next list sync applies
  it with the staged transitions below, keeping demand, exports and receipt
  attribution. `shop.overview` lists the choices as `manualNoteProductIds`.
- Notes need a plugin with the `list.notes` feature. Without it nothing is
  sent and the line is listed for review (`notes_unsupported`); only *Release*
  applies.
- A note with the same text that someone else wrote is never claimed, edited
  or removed. gm-sync removes only the note it wrote, and only while its text
  is unchanged. A note someone removed or edited is released and not added
  again until the demand changes.
- Changes are staged so one demand never has two managed lines: our product
  units are removed before a note is added, a note is removed before the
  product returns, and a changed amount removes the old note before the new
  one is added in a later sync. A failed removal keeps the old line and blocks
  the new one; a conflicting removal releases the old line to the household.
- An uncertain note write stays pending. A plugin may settle it from the list,
  but a matching note found after an uncertain add is never owned (it may be
  the household's): it covers the demand and stays when the demand ends.
- Mealie rows are never checked off because a note disappeared. The demand
  stays attached to the original export: once a note was on the list, a
  receipt for any product mapped to the same target counts it as exported
  demand, including credits for manual checks.


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

- Rows created by the low-stock sync carry stock amounts labelled with the
  stock unit. Rows written by older versions may still carry the purchase unit
  label when purchase and stock units differ; such rows are sent to review
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

Use `plugins.catalog_search` (with optional `refresh`), `plugins.catalog_refresh`,
`shop.products.list`, `shop.mappings.list`, `shop.targets.search`,
`shop.mappings.save/update/delete`, `shop.suggestions.decide` and
`shop.searches.retry` for products and proposals. `shop.overview` reads all Shop
tabs, including receipt lines, ownership, pending effects and discrepancies.
`shop.lists.sync`, `shop.receipts.pull`, `shop.lines.resolve`,
`shop.review.resolve`, `shop.effects.resolve` and `shop.discrepancies.resolve`
(`shop.lines.resolve` takes `kind: note` for a waiting replacement note)
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


### Mapping safety and availability

The product table searches your own ingredients separately from retailer products.
Opening a retailer combobox shows remembered products immediately and searches the
own ingredient name after a debounce without prefilling the input. Typing a query
replaces that live search and keeps the local and live results merged. Closed rows
never call a plugin. Availability is shared per provider: a refresh can use another
connected installation of the same provider. A returned product without an explicit
availability statement does not verify its old availability.

UI and MCP mapping writes require an explicit package amount and the expected
Grocy stock unit before confirmation. A derived amount is a suggestion until the
caller echoes it. Reassigning a retailer product to an unrelated own target requires
`reassign: true`; linked Mealie-to-Grocy canonical moves are allowed. An alternative
can be replaced atomically with `replacesMappingId`. Deleting, demoting or moving a
preferred mapping forgets its manual text-item preference for every account.

Notes identified only by text have an upstream limitation: removing a managed note
and readding identical text cannot be distinguished from the original note. An
interrupted add that later finds matching text leaves it unowned and records a
history message asking the household to remove it manually when bought.


When switching the preferred product, the old managed product or note must leave
the list first. Failed removals and paused ownership block the replacement, and
the product table/editor name the old product that is holding it up. The same
`listReplacementBlocks` details are readable in the MCP shop overview, including
while a plugin is offline. Resolve a household edit through Shop Overview rather
than adding a second representation.

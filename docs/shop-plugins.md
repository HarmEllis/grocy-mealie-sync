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
  headers only and never booked. The boundary only moves forward.

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

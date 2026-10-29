# Shopping — feature coverage

Checklist for validating `shopping.html` against the real gm-sync Shopping page.
Column *Where* names the section and, where useful, the `data-od-id` to look for.

Demo snapshots: **Busy** (everything needs attention), **All clear** (zero state), **No plugins**.
Switch them in the prototype footer (`demo-bar`).

## Page frame

| Real-app feature | Where | Notes |
|---|---|---|
| Title *Shopping* + subtitle | `page-head` / `page-title` | |
| Refresh with loading spinner | `refresh-control` / `refresh-now` | Spinner replaces the icon; button disabled while busy |
| Auto-refresh every 30s indicator | `refresh-control` → `#auto-in` | Live countdown, fires a silent refresh at 0 |
| *Sync lists now* | `sync-lists-now` | Only primary button in the header |
| Attention badge `{n} item(s) need attention` | `attention-badge` | n = review lines + blocked projection rows + discrepancies + uncertain writes + paused lines; links to Review |
| Plugin connection chips per retailer | `plugin-chips` / `chip-<id>` | connected / offline |
| Empty state when no plugins installed | `no-plugins-panel` | Exact copy incl. “Without plugins the regular sync is unchanged.” |
| Five sections as tabs | `section-tabs` | Overview, Products, Receipts, Review (count badge), Diagnostics |
| Swipeable tabs on mobile | `#sections` touch handler | Horizontal swipe ≥70px; ←/→ keys on the tablist |
| Status hero + KPI tiles | `status-hero` / `kpi-tiles` | Each tile jumps to its section |

## 1. Overview

| Real-app feature | Where | Notes |
|---|---|---|
| Plugins list per installation | `panel-plugins` / `plugin-<id>` | name + connected/offline |
| Badge *text items* (supports `list.notes`) | `plugin-<id>` | with an explanation line per capability |
| Badge *list sync* | `plugin-<id>` | |
| Badge *receipts* | `plugin-<id>` | |
| Warning *list write pending confirmation* | `plugin-ah` | points at Review |
| Projection review *Not sent to retailer* | `panel-projection` / `projection-<id>` | label + plugin + reason + fix action; Overview shows the first 3 with `projection-show-all` / `projection-open-review`, Review lists all of them |
| Reason: no product (select a Mealie ingredient) | `projection-p1` | |
| Reason: no preferred retailer product mapped | `projection-p2` | |
| Reason: mapping unconfirmed | `projection-p3` | |
| Reason: mapped base unit changed, confirm amount again | `projection-p4` | |
| Reason: Grocy product or stock unit missing | `projection-p5` | |
| Reason: missing unit | `projection-p6` | |
| Reason: purchase unit differs from stock unit | `projection-p7` | |
| Reason: no conversion between Mealie unit and base unit | `projection-p8` | |
| Hint: fix mapping/unit, next sync retries automatically | `panel-projection` row hint | on every row |
| Empty: *No blocked shopping rows reported.* | `panel-projection` | All clear snapshot |
| *On the shared list* (Plugin, Product, Packages, Since) | `panel-shared` / `shared-<i>` | table → cards under 800px; the Plugin cell is a compact inline `.plug` chip |
| Note: your own additions are kept | `panel-shared` footer | |
| Empty: *Nothing exported.* | `panel-shared` | No plugins snapshot |
| *Replacement text items* | `panel-notes` / `note-<i>` | note text + plugin + “replaces {product}” |
| Explanation: a note never fulfils Mealie demand, receipts decide | `panel-notes` footer | |
| *Paused list lines* | `panel-paused` / `paused-<id>` | product + pause reason + “now X, last written Y” |
| Pause reason: someone reduced this line | `paused-l1` | |
| Pause reason: the line disappeared | `paused-l2` | |
| Pause reason: product on the list more than once | `paused-l3` | Release only |
| Pause reason: line now holds another product | `paused-l4` | Release only |
| Pause reason: discontinued, plugin cannot add a text item | `paused-l5` | Release only |
| Actions: removed their own units / add mine again / release | `line-removed-*`, `line-readd-*`, `line-release-*` | first two disabled for notes, duplicates and reused lines |
| Empty: *No paused lines.* | `panel-paused` | All clear snapshot |

## 2. Products

| Real-app feature | Where | Notes |
|---|---|---|
| Work queue To map / Mapped / Needs attention | `queue-tab-todo|mapped|attention` | with counts and a progress ring |
| Search | `product-search` | |
| Source filter Grocy+Mealie / Grocy only / Mealie only | `source-filter` | |
| Status filter | `status-filter` | unit changed, unconfirmed amount, discontinued, missing conversion |
| Per-shop detail with suggested match + score | `shop-<id>` | one section per installed plugin |
| Catalogue search | `catalogue-search-<id>` | debounce → searching → results / no results |
| Alternatives | `alternative-<id>-<i>` | |
| Conversion / unit & amount | `conversion-<id>`, `amount-<id>`, `unit-<id>` | |
| Discontinued replacement | product *Pasta penne* | warning banner + text-item fallback field |
| Plugin disconnect / reconnect | `connection-<id>` | disconnected search state with retry |
| Keyboard navigation | ↑↓ / J K, Enter confirms, Esc closes the sheet | hints under the workspace |
| **(a)** Suggestions inbox with Accept / Reject | `suggestions-inbox`, `accept-*`, `reject-*` | |
| **(a)** Score % | `.score` in each suggestion | |
| **(a)** show 5 / show all | `toggle-suggestion-count` | 7 suggestions in the Busy snapshot |
| **(b)** Shopping ingredients to map | `ingredients-panel` / `ingredient-<id>` | |
| **(b)** Status: waiting for catalogue search | `ingredient-i-2` | spinner |
| **(b)** Status: error | `ingredient-i-3` | error text, never retried on its own |
| **(b)** Status: found N products | `ingredient-i-1`, `-i-4`, `-i-5` (0 found) | |
| **(b)** *Search again* | `search-again-<id>` | |
| **(c)** Role: Preferred product / Remembered alternative | `role-line` in each mapped shop | |
| **(c)** *Use as preferred* | `use-preferred-<id>`, alternatives list | |
| **(c)** Remove (trash) | `remove-mapping-<id>`, alternative trash | |
| **(d)** *Fulfils all demand* toggle for loose produce | `settles-<id>` | only for per-kg products (Appels, Tomaten los) |
| **(e)** Mapping target legend G+M / G / M | `target-legend` | G+M marked recommended |
| **(e)** Move-mapping warning | `target-<id>` → warning banner | “Moving this mapping removes its link to X. Check the amount in the new target unit” |
| **(f)** Unit preview | `preview-<id>` | shows the resulting stock amount |
| **(f)** Retry | `retry-conversion-<id>` | product *Yoghurt naturel* starts in the failed state |
| **(f)** *Use suggested amount* derivation | `suggested-amount-<id>` | derives from the package size |
| **(f)** Conversion availability + link to Units & Conversions | `units-link-<id>` | also shown when units are incompatible |
| **(g)** Mealie unit picker incl. *Count (no unit)* | `mealie-unit-<id>` | product-level unit under More options, hidden for Grocy-only targets |
| **(a2)** Text item account selector per retailer | `text-account-<id>` | only when the retailer has several installations; option label is *retailer — account* |
| **(a2)** Single-account retailers name the account inline | text-item block | no selector, just *Albert Heijn — Household list* |
| **(a2)** Toggle *Use an ingredient + quantity text item…* | `text-item-toggle-<id>` | manual on / off |
| **(a2)** Discontinued product locks the toggle on | *Pasta penne* → Albert Heijn | “Locked on — this retailer product is discontinued…” |
| **(a2)** Disabled: plugin has no `list.notes` | *any product* → Jumbo, Picnic | “Jumbo cannot add list notes… A discontinued product pauses the line instead.” |
| **(a2)** Disabled: account not bound | Albert Heijn → *Shared household* | “Sign in to the retailer first.” |
| **(a2)** Status line on the product row | `.row-flags` → *Text item for AH — Household list* | shown while a text item is active |
| **(a2)** Free-text *Text-item fallback* | `fallback-<id>` | moved into the text-item block, disabled when the block is |
| **(a2)** A text item settles a retailer for confirming | `confirm-mapping` | a discontinued retailer no longer blocks the save; the hint counts the text-item retailers |
| **(b2)** Replacement waiting notice | `replacement-<id>` | “Waiting for {old product} to leave the list ({account}). Review the old line in Overview → Paused list lines if it remains paused.” |
| **(b2)** Paused escalation | *Pasta penne* → Jumbo | adds “Waiting for the paused product line. Resolve it before the text item can replace it.” |
| **(b2)** Link to the paused lines | `replacement-link-<id>` | jumps to Overview → Paused list lines |
| **(b2)** Notice on the product row | `.row-flags` amber flag | on *Pasta penne* (paused) and *Olijfolie* (not paused) |
| **(c2)** Availability: Discontinued | *Pasta penne* → Albert Heijn | danger, “list sync needs a text item or a new preferred product” |
| **(c2)** Availability: Temporarily out of stock | *Rijst basmati* → Jumbo | warning, “preferred product stays on the list” |
| **(c2)** Availability: Availability unknown | *Havermout* → Picnic | muted, “the retailer did not report a status” |
| **(c2)** Availability on the queue row | `.row-flags` | worst status across the retailers, tone carried by the icon |
| **(d2)** Linked Mealie mapping row | `mealie-row-<id>` | labelled *Linked Mealie mapping · {food}*, only for Grocy + Mealie targets |
| **(d2)** Its own unit & amount | `mealie-amount-<id>`, `mealie-food-unit-<id>` | edited separately from the Grocy package amount and from the product-level Mealie unit |
| **(e2)** Mapping count line | `.row-flags` → *1 alternative* | sums the remembered alternatives across retailers |

## 3. Receipts

| Real-app feature | Where | Notes |
|---|---|---|
| *Pull receipts now* | `pull-receipts` | loading state |
| Retailer picker | `receipt-retailer` | only receipt-capable plugins |
| Latest 5 / Latest 10 receipts | `receipt-count` | |
| *Load receipts for setup* + loading state | `load-receipts` | skeleton rows while loading |
| Explanation: reference only, never books stock or checks items off | `panel-receipt-pull` subtitle + footer | |
| Receipt cards: date, store, status, total | `receipt-<id>` | |
| Lines: description, mapping summary, qty+unit, amount | `rline-<id>-<i>` | “Mapped to X, 500 g per package” |
| Line status with review reason | badges on each line | |
| Attribution of what was linked | badges `stock 3`, `list 1` | |
| *Map product* / *Change mapping* | `map-line-<id>-<i>` | opens the mapping editor |
| Header-only receipts | `receipt-r3` | “Bought before receipt processing was enabled; kept as a header only.” |
| Empty: *No receipts stored yet.* | No plugins snapshot | |
| From-receipt bulk mapping reachable | `bulk-receipt-mapping` | links to `shop-mappings.html` |
| Failed receipt check surfaced | `receipt-error-jumbo` | danger banner + retry |

## 4. Review

| Real-app feature | Where | Notes |
|---|---|---|
| Grouped inbox with counts per group | `review-projection|lines|disc|writes` | collapsible |
| Not sent to retailer (same projection rows) | `review-projection` | |
| Receipt lines to review — *Nothing here was booked* | `review-lines` group note | |
| Line detail: description, qty, unit, amount, reason | `review-line-<id>` | |
| Reason: retailer did not identify product | `review-line-rv3` | |
| Reason: no mapping yet | `review-line-rv1` | |
| Reason: package amount not confirmed | `review-line-rv2` | |
| Reason: return or correction | `review-line-rv4` | |
| Reason: receipt unit does not fit mapping | `review-line-rv5` | |
| Reason: product unit changed, confirm again | `review-line-rv6` | |
| Reason: several manual checks could match | `review-line-rv7` | |
| *One-off substitution* (expands) | `substitution-<id>` → `subform-<id>` | |
| … checkbox *Fulfil demand only, book nothing in Grocy* | `fulfil-only-<id>` | disables the product + amount fields |
| … Grocy product searchable select | `sub-product-<id>` | datalist `grocy-targets` |
| … stock amount | `sub-amount-<id>` | |
| … *Remember as alternative* | `sub-remember-<id>` | |
| … multi-select of open shopping rows this fulfils (removed) | `sub-open-*` | note explains removal |
| … multi-select of rows already checked off (flagged for review) | `sub-checked-*` | |
| … *Confirm substitution* | `confirm-substitution-<id>` | |
| *Process again (after mapping)* | `process-again-<id>` | |
| *Dismiss* | `dismiss-<id>` | |
| Discrepancy: manual check booked X, receipt shows Y | `discrepancy-d1` | undo booking #4821, amount + consume difference, keep stock as is |
| Discrepancy: substitute bought, original already booked | `discrepancy-d2` | |
| Discrepancy: row checked off while a receipt already fulfilled it | `discrepancy-d3` | *The receipt covers it* / *It was an additional purchase, book it* |
| Booking evidence readable, not raw JSON | `.evidence` key/value list | |
| Writes needing a decision | `write-<id>` | label, status badge unknown/failed, kind, source, attempts, last error, evidence |
| Actions *It happened* / *It did not happen, retry* / *Skip* | `write-happened-*`, `write-retry-*`, `write-skip-*` | retry only for `unknown` |
| Note: never retried automatically | `review-writes` group note | |
| Empty: *All writes are settled.* | All clear snapshot | |
| Zero-state celebration | `review-clear` | |

## 5. Diagnostics

| Real-app feature | Where | Notes |
|---|---|---|
| *Sync diagnostics* + *View full history* | `panel-sync-diagnostics`, `view-full-history` | |
| Last receipt fetch | `diag-top` cell 1 | |
| Next receipt fetch with countdown / *Due / waiting for worker* | `#next-fetch`, `#next-fetch-countdown` | live countdown, flips to Due at 0 |
| Last shopping job (time + status) | `diag-top` cell 3 | |
| Per plugin card with state | `diag-<id>` | |
| State: Receipt processing disabled | `diag-picnic` (All clear) | |
| State: Waiting for plugin connection and active scheduler | `diag-crisp` (Busy) | Crisp is installed but never connected, so it has no catalogue and is left out of the Products workflow; its long badge wraps under the plugin name |
| State: Plugin does not support receipts | `diag-picnic` (Busy) | |
| State: Waiting for retailer sign-in | `diag-jumbo` (Busy) | |
| State: Connected | `diag-ah` | |
| Last receipt check / next check | `diag-<id>` kv list | |
| Last list sync: result status, applied, failed, conflicts, message | `diag-<id>` kv list + hint | |
| Last check error in danger tone | `diag-jumbo` → `.diag-error` | |
| Footnote on schedules | `panel-plugin-diagnostics` footer | 30 min checks, reconnect/notification, worker every minute, busy jobs delay processing |
| *List cleanup* explanation | `panel-cleanup` subtitle | managed quantity removed, household quantity kept |
| Cleanup per line: product, plugin, managed, household, desired, pause | `cleanup-<i>` | the Plugin cell is a compact inline `.plug` chip |
| Desired *Not applicable (replacement note)* | `cleanup-2` | |

## Retailer accounts in the sample data

| Plugin | `list.notes` | Accounts | What it demonstrates |
|---|---|---|---|
| Albert Heijn | yes | Household list, Second account, Shared household (not signed in) | the account selector, a working toggle, the locked-on discontinued case, and the not-signed-in explanation |
| Jumbo | no | Main account | the text-item block disabled because the plugin cannot add notes |
| Picnic | no | Main account | same, on a plugin that also has no receipts |
| Crisp | no | Main account (not signed in) | installed but never connected: no catalogue, so it is absent from Products |

In the All clear snapshot Albert Heijn keeps two bound accounts and no product is waiting on a replacement.

## How this revision was verified

- Every one of the three snapshots was driven through all five tabs, plus ~100 interactions
  (tab switches, projection expand/collapse, receipt pull and load, every Review action, the
  substitution form, and the full Products workflow including the text-item states). 485 render
  passes, no runtime errors, no unbalanced markup, and no `undefined` / `NaN` reaching the copy.
- 50 assertions check that each fix and each new feature is actually present in the rendered
  markup — see the *Where* column above for the ids they look for.
- The 1440px and 390px layouts were reviewed statically against the stylesheet (grid minimums,
  wrapping, touch targets and foreground/background contrast pairs in both themes), not from a
  pixel render.

## Known gaps

- The Products workflow is a parallel implementation that reuses `shop-workspace.css` from `shop-mappings.html`; it does not share JS with `shop-mappings.js`, so behaviour changes must be made in both places.
- All amounts, receipts, errors and timestamps are illustrative demo data.
- Text-item configuration lives in a per-product/per-retailer store in `shopping-products.js`; it survives a confirm but, like the rest of the prototype, resets when the demo snapshot is switched.

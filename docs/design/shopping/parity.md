# Shopping design parity

Acceptance checklist for the Shopping redesign (PR #78). Source of truth is the design snapshot in `src/`
(open `src/shopping.html` in a browser; the demo switcher in the footer toggles Busy, All clear and No plugins).
Reference screenshots live in `screenshots/` (`<tab>-<state>-<width>.jpg`).

Status values: `todo`, `done`, `adapted` (see the table below), `n/a` (prototype only).
Every row must be `done`, `adapted` or `n/a` before the redesign is complete. Update this file in each step.

## Intentional adaptations (prototype behaviour the backend does not have)

| Design feature | Real invariant | Adaptation |
|---|---|---|
| Free-text "Text-item fallback" input | Backend stores only a boolean per account and retailer product (`src/lib/shop/note-preferences.ts`) and requires a preferred mapping; text is derived | Account selector and toggle with the real locked/unbound/no-`list.notes` states; derived text shown, no free text, no text item without a preferred mapping |
| "Linked Mealie mapping" with its own amount and unit | `saveRetailerMapping` rejects Mealie-food mappings of Grocy-linked foods (409) | Legacy row shown with the real migrate-on-confirm flow; new mappings never get a separate Mealie amount |
| Target-kind switcher; arbitrary conversion units on Grocy targets | Source is derived from `product_mappings`; a Grocy target's base unit is its stock unit | Source read-only; unit picker only for Mealie-food targets; stock unit and derived conversions for Grocy targets |
| Disconnect/Reconnect plugin toggle | Connectivity comes from `overview.installations` | Real connectivity and the "known products only" offline state with Retry |
| "From-receipt bulk mapping" link to a separate page | No such page in the app | "Lines to map only" filter on receipt lines with the existing Map product dialog |
| Detail footer "Confirm & next" requires every shop settled | A household may use one retailer | Saves every pending valid draft and advances; never requires all retailers |
| Hero ring with a delivery percentage | Exports are projected demand, not confirmed writes, and rows and rejections have different units | Status icon (warning or check) in the ring slot; no percentage |
| Demo-state switcher, "Interactive prototype" note | Prototype only | Not shipped |
| "Auto-refresh" indicator | Page already polls every 30 s | Shown, driven by the real poll |

## Feature matrix (from the design coverage checklist)

Checklist for validating `shopping.html` against the real gm-sync Shopping page.
Column *Where* names the section and, where useful, the `data-od-id` to look for.

Demo snapshots: **Busy** (everything needs attention), **All clear** (zero state), **No plugins**.
Switch them in the prototype footer (`demo-bar`).

## Page frame

| Real-app feature | Where | Notes | Implementation | Status |
|---|---|---|---|---|
| Title *Shopping* + subtitle | `page-head` / `page-title` | | `src/app/shopping/page.tsx` (`PageHeader`) | done |
| Refresh with loading spinner | `refresh-control` / `refresh-now` | Spinner replaces the icon; button disabled while busy | `ShoppingDashboard.tsx` refresh control | done |
| Auto-refresh every 30s indicator | `refresh-control` → `#auto-in` | Live countdown, fires a silent refresh at 0 | `ShoppingDashboard.tsx` countdown, silent reload at 0 | done |
| *Sync lists now* | `sync-lists-now` | Only primary button in the header | `ShoppingDashboard.tsx`, `POST /api/shop/run` | done |
| Attention badge `{n} item(s) need attention` | `attention-badge` | n = review lines + blocked projection rows + discrepancies + uncertain writes + paused lines; links to Review | `ShoppingDashboard.tsx` `attention-badge`; shows held-back rows and pending writes when no decisions wait | done |
| Plugin connection chips per retailer | `plugin-chips` / `chip-<id>` | connected / offline | `ShoppingDashboard.tsx` `plugin-chips` | done |
| Empty state when no plugins installed | `no-plugins-panel` | Exact copy incl. “Without plugins the regular sync is unchanged.” | `ShoppingDashboard.tsx` `no-plugins-panel` | done |
| Five sections as tabs | `section-tabs` | Overview, Products, Receipts, Review (count badge), Diagnostics | `ShoppingDashboard.tsx` `section-tabs` (ARIA tablist, arrow keys, Home/End) | done |
| Swipeable tabs on mobile | `#sections` touch handler | Horizontal swipe ≥70px; ←/→ keys on the tablist | `ShoppingDashboard.tsx` swipe >= 70px on the panel area | done |
| Status hero + KPI tiles | `status-hero` / `kpi-tiles` | Each tile jumps to its section | `shop-ui.tsx` `StatusHero`, `KpiTile`; ring shows a status icon (adaptation, see top) | adapted |

## 1. Overview

| Real-app feature | Where | Notes | Implementation | Status |
|---|---|---|---|---|
| Plugins list per installation | `panel-plugins` / `plugin-<id>` | name + connected/offline | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Badge *text items* (supports `list.notes`) | `plugin-<id>` | with an explanation line per capability | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Badge *list sync* | `plugin-<id>` | | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Badge *receipts* | `plugin-<id>` | | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Warning *list write pending confirmation* | `plugin-ah` | points at Review | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Projection review *Not sent to retailer* | `panel-projection` / `projection-<id>` | label + plugin + reason + fix action; Overview shows the first 3 with `projection-show-all` / `projection-open-review`, Review lists all of them | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Reason: no product (select a Mealie ingredient) | `projection-p1` | | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Reason: no preferred retailer product mapped | `projection-p2` | | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Reason: mapping unconfirmed | `projection-p3` | | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Reason: mapped base unit changed, confirm amount again | `projection-p4` | | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Reason: Grocy product or stock unit missing | `projection-p5` | | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Reason: missing unit | `projection-p6` | | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Reason: purchase unit differs from stock unit | `projection-p7` | | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Reason: no conversion between Mealie unit and base unit | `projection-p8` | | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Hint: fix mapping/unit, next sync retries automatically | `panel-projection` row hint | on every row | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Empty: *No blocked shopping rows reported.* | `panel-projection` | All clear snapshot | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| *On the shared list* (Plugin, Product, Packages, Since) | `panel-shared` / `shared-<i>` | table → cards under 800px; the Plugin cell is a compact inline `.plug` chip | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Note: your own additions are kept | `panel-shared` footer | | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Empty: *Nothing exported.* | `panel-shared` | No plugins snapshot | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| *Replacement text items* | `panel-notes` / `note-<i>` | note text + plugin + “replaces {product}” | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Explanation: a note never fulfils Mealie demand, receipts decide | `panel-notes` footer | | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| *Paused list lines* | `panel-paused` / `paused-<id>` | product + pause reason + “now X, last written Y” | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Pause reason: someone reduced this line | `paused-l1` | | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Pause reason: the line disappeared | `paused-l2` | | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Pause reason: product on the list more than once | `paused-l3` | Release only | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Pause reason: line now holds another product | `paused-l4` | Release only | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Pause reason: discontinued, plugin cannot add a text item | `paused-l5` | Release only | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Actions: removed their own units / add mine again / release | `line-removed-*`, `line-readd-*`, `line-release-*` | first two disabled for notes, duplicates and reused lines | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |
| Empty: *No paused lines.* | `panel-paused` | All clear snapshot | `tabs/OverviewTab.tsx`, `tabs/ProjectionReview.tsx`, `tabs/PausedLines.tsx` | done |

## 2. Products

| Real-app feature | Where | Notes | Implementation | Status |
|---|---|---|---|---|
| Work queue To map / Mapped / Needs attention | `queue-tab-todo|mapped|attention` | with counts and a progress ring | `products/ProductQueue.tsx` | done |
| Search | `product-search` | | `products/ProductQueue.tsx` | done |
| Source filter Grocy+Mealie / Grocy only / Mealie only | `source-filter` | | `products/ProductQueue.tsx` | done |
| Status filter | `status-filter` | unit changed, unconfirmed amount, discontinued, missing conversion **Adapted:** Unit changed, Unconfirmed amount, Discontinued; "Missing conversion" is only shown in the detail preview (plan decision 2) | `products/ProductQueue.tsx` | adapted |
| Per-shop detail with suggested match + score | `shop-<id>` | one section per installed plugin | `products/ProductDetail.tsx` | done |
| Catalogue search | `catalogue-search-<id>` | debounce → searching → results / no results | `products/ProductDetail.tsx` | done |
| Alternatives | `alternative-<id>-<i>` | | `products/ProductDetail.tsx` | done |
| Conversion / unit & amount | `conversion-<id>`, `amount-<id>`, `unit-<id>` | | `products/MappingForm.tsx` | done |
| Discontinued replacement | product *Pasta penne* | warning banner + text-item fallback field | `products/ProductDetail.tsx` | done |
| Plugin disconnect / reconnect | `connection-<id>` | disconnected search state with retry **Adapted:** Real connectivity from the installation; offline plugins show "Plugin offline" and the known-products-only search with Retry (no toggle) | `products/ProductDetail.tsx` | adapted |
| Keyboard navigation | ↑↓ / J K, Enter confirms, Esc closes the sheet | hints under the workspace | `products/ProductQueue.tsx` | done |
| **(a)** Suggestions inbox with Accept / Reject | `suggestions-inbox`, `accept-*`, `reject-*` | | `products/ProductsTab.tsx` (inbox, bulk endpoint) | done |
| **(a)** Score % | `.score` in each suggestion | | `products/ProductsTab.tsx` (inbox, bulk endpoint) | done |
| **(a)** show 5 / show all | `toggle-suggestion-count` | 7 suggestions in the Busy snapshot | `products/ProductsTab.tsx` (inbox, bulk endpoint) | done |
| **(b)** Shopping ingredients to map | `ingredients-panel` / `ingredient-<id>` | | `products/ProductsTab.tsx` (inbox, bulk endpoint) | done |
| **(b)** Status: waiting for catalogue search | `ingredient-i-2` | spinner | `products/ProductsTab.tsx` (inbox, bulk endpoint) | done |
| **(b)** Status: error | `ingredient-i-3` | error text, never retried on its own | `products/ProductsTab.tsx` (inbox, bulk endpoint) | done |
| **(b)** Status: found N products | `ingredient-i-1`, `-i-4`, `-i-5` (0 found) | | `products/ProductsTab.tsx` (inbox, bulk endpoint) | done |
| **(b)** *Search again* | `search-again-<id>` | | `products/ProductQueue.tsx` | done |
| **(c)** Role: Preferred product / Remembered alternative | `role-line` in each mapped shop | | `products/ProductDetail.tsx` | done |
| **(c)** *Use as preferred* | `use-preferred-<id>`, alternatives list | | `products/ProductDetail.tsx` | done |
| **(c)** Remove (trash) | `remove-mapping-<id>`, alternative trash | | `products/ProductDetail.tsx` | done |
| **(d)** *Fulfils all demand* toggle for loose produce | `settles-<id>` | only for per-kg products (Appels, Tomaten los) | `products/MappingForm.tsx` | done |
| **(e)** Mapping target legend G+M / G / M | `target-legend` | G+M marked recommended | `products/ProductsTab.tsx` (inbox, bulk endpoint) | done |
| **(e)** Move-mapping warning | `target-<id>` → warning banner | “Moving this mapping removes its link to X. Check the amount in the new target unit” **Adapted:** Shown for a legacy mapping that moves to the canonical product; there is no target switcher | `products/ProductDetail.tsx` | adapted |
| **(f)** Unit preview | `preview-<id>` | shows the resulting stock amount | `products/MappingForm.tsx` | done |
| **(f)** Retry | `retry-conversion-<id>` | product *Yoghurt naturel* starts in the failed state | `products/MappingForm.tsx` | done |
| **(f)** *Use suggested amount* derivation | `suggested-amount-<id>` | derives from the package size | `products/MappingForm.tsx` | done |
| **(f)** Conversion availability + link to Units & Conversions | `units-link-<id>` | also shown when units are incompatible | `products/MappingForm.tsx` | done |
| **(g)** Mealie unit picker incl. *Count (no unit)* | `mealie-unit-<id>` | product-level unit under More options, hidden for Grocy-only targets | `products/MappingForm.tsx` | done |
| **(a2)** Text item account selector per retailer | `text-account-<id>` | only when the retailer has several installations; option label is *retailer — account* | `products/ProductDetail.tsx` | done |
| **(a2)** Single-account retailers name the account inline | text-item block | no selector, just *Albert Heijn — Household list* | `products/ProductDetail.tsx` | done |
| **(a2)** Toggle *Use an ingredient + quantity text item…* | `text-item-toggle-<id>` | manual on / off | `products/ProductDetail.tsx` | done |
| **(a2)** Discontinued product locks the toggle on | *Pasta penne* → Albert Heijn | “Locked on — this retailer product is discontinued…” | `products/ProductDetail.tsx` | done |
| **(a2)** Disabled: plugin has no `list.notes` | *any product* → Jumbo, Picnic | “Jumbo cannot add list notes… A discontinued product pauses the line instead.” | `products/ProductDetail.tsx` | done |
| **(a2)** Disabled: account not bound | Albert Heijn → *Shared household* | “Sign in to the retailer first.” | `products/ProductDetail.tsx` | done |
| **(a2)** Status line on the product row | `.row-flags` → *Text item for AH — Household list* | shown while a text item is active | `products/ProductQueue.tsx` | done |
| **(a2)** Free-text *Text-item fallback* | `fallback-<id>` | moved into the text-item block, disabled when the block is | `products/ProductDetail.tsx` | done |
| **(a2)** A text item settles a retailer for confirming | `confirm-mapping` | a discontinued retailer no longer blocks the save; the hint counts the text-item retailers | `products/ProductDetail.tsx` | done |
| **(b2)** Replacement waiting notice | `replacement-<id>` | “Waiting for {old product} to leave the list ({account}). Review the old line in Overview → Paused list lines if it remains paused.” | `products/ProductDetail.tsx` | done |
| **(b2)** Paused escalation | *Pasta penne* → Jumbo | adds “Waiting for the paused product line. Resolve it before the text item can replace it.” | `products/ProductDetail.tsx` | done |
| **(b2)** Link to the paused lines | `replacement-link-<id>` | jumps to Overview → Paused list lines | `products/ProductDetail.tsx` | done |
| **(b2)** Notice on the product row | `.row-flags` amber flag | on *Pasta penne* (paused) and *Olijfolie* (not paused) | `products/ProductQueue.tsx` | done |
| **(c2)** Availability: Discontinued | *Pasta penne* → Albert Heijn | danger, “list sync needs a text item or a new preferred product” | `products/ProductDetail.tsx` | done |
| **(c2)** Availability: Temporarily out of stock | *Rijst basmati* → Jumbo | warning, “preferred product stays on the list” | `products/ProductDetail.tsx` | done |
| **(c2)** Availability: Availability unknown | *Havermout* → Picnic | muted, “the retailer did not report a status” | `products/ProductDetail.tsx` | done |
| **(c2)** Availability on the queue row | `.row-flags` | worst status across the retailers, tone carried by the icon | `products/ProductQueue.tsx` | done |
| **(d2)** Linked Mealie mapping row | `mealie-row-<id>` | labelled *Linked Mealie mapping · {food}*, only for Grocy + Mealie targets **Adapted:** Legacy rows only, listed with the real migrate-on-confirm flow | `products/ProductDetail.tsx` | adapted |
| **(d2)** Its own unit & amount | `mealie-amount-<id>`, `mealie-food-unit-<id>` | edited separately from the Grocy package amount and from the product-level Mealie unit **Adapted:** No separate Mealie amount; confirming in the Grocy stock unit moves a legacy mapping | `products/MappingForm.tsx` | adapted |
| **(e2)** Mapping count line | `.row-flags` → *1 alternative* | sums the remembered alternatives across retailers | `products/ProductQueue.tsx` | done |

## 3. Receipts

| Real-app feature | Where | Notes | Implementation | Status |
|---|---|---|---|---|
| *Pull receipts now* | `pull-receipts` | loading state | `tabs/ReceiptsTab.tsx` | done |
| Retailer picker | `receipt-retailer` | only receipt-capable plugins | `tabs/ReceiptsTab.tsx` | done |
| Latest 5 / Latest 10 receipts | `receipt-count` | | `tabs/ReceiptsTab.tsx` | done |
| *Load receipts for setup* + loading state | `load-receipts` | skeleton rows while loading | `tabs/ReceiptsTab.tsx` | done |
| Explanation: reference only, never books stock or checks items off | `panel-receipt-pull` subtitle + footer | | `tabs/ReceiptsTab.tsx` | done |
| Receipt cards: date, store, status, total | `receipt-<id>` | | `tabs/ReceiptsTab.tsx` | done |
| Lines: description, mapping summary, qty+unit, amount | `rline-<id>-<i>` | “Mapped to X, 500 g per package” | `tabs/ReceiptsTab.tsx` | done |
| Line status with review reason | badges on each line | | `tabs/ReceiptsTab.tsx` | done |
| Attribution of what was linked | badges `stock 3`, `list 1` | | `tabs/ReceiptsTab.tsx` | done |
| *Map product* / *Change mapping* | `map-line-<id>-<i>` | opens the mapping editor | `tabs/ReceiptsTab.tsx` | done |
| Header-only receipts | `receipt-r3` | “Bought before receipt processing was enabled; kept as a header only.” | `tabs/ReceiptsTab.tsx` | done |
| Empty: *No receipts stored yet.* | No plugins snapshot | | `tabs/ReceiptsTab.tsx` | done |
| From-receipt bulk mapping reachable | `bulk-receipt-mapping` | links to `shop-mappings.html` | `tabs/ReceiptsTab.tsx` | adapted |
| Failed receipt check surfaced | `receipt-error-jumbo` | danger banner + retry | `tabs/ReceiptsTab.tsx` | done |

## 4. Review

| Real-app feature | Where | Notes | Implementation | Status |
|---|---|---|---|---|
| Grouped inbox with counts per group | `review-projection|lines|disc|writes` | collapsible | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| Not sent to retailer (same projection rows) | `review-projection` | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| Receipt lines to review — *Nothing here was booked* | `review-lines` group note | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| Line detail: description, qty, unit, amount, reason | `review-line-<id>` | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| Reason: retailer did not identify product | `review-line-rv3` | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| Reason: no mapping yet | `review-line-rv1` | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| Reason: package amount not confirmed | `review-line-rv2` | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| Reason: return or correction | `review-line-rv4` | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| Reason: receipt unit does not fit mapping | `review-line-rv5` | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| Reason: product unit changed, confirm again | `review-line-rv6` | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| Reason: several manual checks could match | `review-line-rv7` | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| *One-off substitution* (expands) | `substitution-<id>` → `subform-<id>` | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| … checkbox *Fulfil demand only, book nothing in Grocy* | `fulfil-only-<id>` | disables the product + amount fields | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| … Grocy product searchable select | `sub-product-<id>` | datalist `grocy-targets` | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| … stock amount | `sub-amount-<id>` | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| … *Remember as alternative* | `sub-remember-<id>` | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| … multi-select of open shopping rows this fulfils (removed) | `sub-open-*` | note explains removal | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| … multi-select of rows already checked off (flagged for review) | `sub-checked-*` | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| … *Confirm substitution* | `confirm-substitution-<id>` | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| *Process again (after mapping)* | `process-again-<id>` | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| *Dismiss* | `dismiss-<id>` | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| Discrepancy: manual check booked X, receipt shows Y | `discrepancy-d1` | undo booking #4821, amount + consume difference, keep stock as is | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| Discrepancy: substitute bought, original already booked | `discrepancy-d2` | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| Discrepancy: row checked off while a receipt already fulfilled it | `discrepancy-d3` | *The receipt covers it* / *It was an additional purchase, book it* | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| Booking evidence readable, not raw JSON | `.evidence` key/value list | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| Writes needing a decision | `write-<id>` | label, status badge unknown/failed, kind, source, attempts, last error, evidence | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| Actions *It happened* / *It did not happen, retry* / *Skip* | `write-happened-*`, `write-retry-*`, `write-skip-*` | retry only for `unknown` | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| Note: never retried automatically | `review-writes` group note | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| Empty: *All writes are settled.* | All clear snapshot | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |
| Zero-state celebration | `review-clear` | | `tabs/ReviewTab.tsx`, `tabs/PausedLines.tsx` | done |

## 5. Diagnostics

| Real-app feature | Where | Notes | Implementation | Status |
|---|---|---|---|---|
| *Sync diagnostics* + *View full history* | `panel-sync-diagnostics`, `view-full-history` | | `tabs/DiagnosticsTab.tsx` | done |
| Last receipt fetch | `diag-top` cell 1 | | `tabs/DiagnosticsTab.tsx` | done |
| Next receipt fetch with countdown / *Due / waiting for worker* | `#next-fetch`, `#next-fetch-countdown` | live countdown, flips to Due at 0 | `tabs/DiagnosticsTab.tsx` | done |
| Last shopping job (time + status) | `diag-top` cell 3 | | `tabs/DiagnosticsTab.tsx` | done |
| Per plugin card with state | `diag-<id>` | | `tabs/DiagnosticsTab.tsx` | done |
| State: Receipt processing disabled | `diag-picnic` (All clear) | | `tabs/DiagnosticsTab.tsx` | done |
| State: Waiting for plugin connection and active scheduler | `diag-crisp` (Busy) | Crisp is installed but never connected, so it has no catalogue and is left out of the Products workflow; its long badge wraps under the plugin name | `tabs/DiagnosticsTab.tsx` | done |
| State: Plugin does not support receipts | `diag-picnic` (Busy) | | `tabs/DiagnosticsTab.tsx` | done |
| State: Waiting for retailer sign-in | `diag-jumbo` (Busy) | | `tabs/DiagnosticsTab.tsx` | done |
| State: Connected | `diag-ah` | | `tabs/DiagnosticsTab.tsx` | done |
| Last receipt check / next check | `diag-<id>` kv list | | `tabs/DiagnosticsTab.tsx` | done |
| Last list sync: result status, applied, failed, conflicts, message | `diag-<id>` kv list + hint | | `tabs/DiagnosticsTab.tsx` | done |
| Last check error in danger tone | `diag-jumbo` → `.diag-error` | | `tabs/DiagnosticsTab.tsx` | done |
| Footnote on schedules | `panel-plugin-diagnostics` footer | 30 min checks, reconnect/notification, worker every minute, busy jobs delay processing | `tabs/DiagnosticsTab.tsx` | done |
| *List cleanup* explanation | `panel-cleanup` subtitle | managed quantity removed, household quantity kept | `tabs/DiagnosticsTab.tsx` | done |
| Cleanup per line: product, plugin, managed, household, desired, pause | `cleanup-<i>` | the Plugin cell is a compact inline `.plug` chip | `tabs/DiagnosticsTab.tsx` | done |
| Desired *Not applicable (replacement note)* | `cleanup-2` | | `tabs/DiagnosticsTab.tsx` | done |

## Retailer accounts in the sample data

| Plugin | `list.notes` | Accounts | What it demonstrates |  | n/a |
|---|---|---|---|---|---|
| Albert Heijn | yes | Household list, Second account, Shared household (not signed in) | the account selector, a working toggle, the locked-on discontinued case, and the not-signed-in explanation |  | n/a |
| Jumbo | no | Main account | the text-item block disabled because the plugin cannot add notes |  | n/a |
| Picnic | no | Main account | same, on a plugin that also has no receipts |  | n/a |
| Crisp | no | Main account (not signed in) | installed but never connected: no catalogue, so it is absent from Products |  | n/a |

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

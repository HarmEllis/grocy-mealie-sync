# Grocy Mealie Sync

Source: exact real-app tokens supplied by the user. Shared styling lives in `shared.css`.

- Default dark page: `#060b14`. Card: `rgba(255,255,255,.04)`. Border: `rgba(255,255,255,.08)`. Raised and hover: white at .06 and .12.
- Dark text: `#e6edf3`, `#8b949e`, `#4a5568`. Sidebar: navy at .95; topbar: navy at .85.
- Teal accent: `#2dd4bf`; hover `#22b4a1`; ink `#0d1117`; subtle/glow at .08/.45. Amber and violet can be selected with `data-accent`.
- Light page: `#eef2f7`. Card: white at .85. Text: `#0f172a`, `#475569`, `#94a3b8`.
- State badges use the supplied success, warning, error, and accent colors. Light text variants preserve legibility.
- Plus Jakarta Sans for body and headings; JetBrains Mono for quantities, units, scores and IDs. Fonts load from Google Fonts, with local fallbacks.
- Base radius: `0.625rem`. Shared spacing tokens remain unchanged.

## Shared components

`shared-components.js` owns the sidebar, mobile bottom navigation, theme/accent controls, icons, badges, progress ring, toast, and `ui.detailPanel`. Shopping is the active navigation item for this page.

`shop-mappings.js` owns the existing own-product workflow. `receipt-mappings.js` owns receipt parsing, conversion resolution, line mappings and bulk review. Both render into the same detail panel. Receipt conversions are scoped to the own product and persisted on this device. Receipt actions update the matching shop in own-product state.

The prototype uses sample catalogue and receipt records. No network services or stock mutations are performed.

## Shopping page

`shopping.html` is the Shopping entry point. It links `shared.css`, `shop-workspace.css` (the queue/detail
chrome extracted verbatim from `shop-mappings.html`), `receipt-mappings.css` and `shopping.css`, and it loads
`shared-components.js`, `shopping-data.js`, `shopping-products.js` and `shopping-app.js`.

- `shop-mappings.html` and its own JS and CSS are unchanged; it keeps its inline copy of the workspace styles.
- Accent is used twice per screen at most: the status-hero rail and the active section tab. Every other signal
  uses the shared success, warning and danger tokens.
- Five sections live behind one tablist: Overview, Products, Receipts, Review, Diagnostics. Tables collapse to
  label/value cards below 800px. Dense in-card controls are 34–38px on fine pointers and grow to 44px on coarse
  pointers and small screens, matching the existing workspace rules.
- `shopping-data.js` holds three switchable sample snapshots (busy, all clear, no plugins). Nothing is fetched
  and no stock is mutated.

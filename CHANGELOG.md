# Changelog

All notable changes to this project are documented in this file.

## [1.9.0] - 2026-04-05

This minor release adds MCP inventory-entry creation and hardens the Grocy stock-entry resolution path so create-entry mutations remain accurate under concurrent writes and merged stock batches.

### Added

- New `inventory.create_entry` MCP tool support, including prompt/catalog wiring and structured contract coverage for inventory-entry creation flows.
- Action-history coverage and payload support for create-entry operations so manual MCP mutations are auditable from the History UI and API.

### Changed

- Inventory entry creation now prefers transaction-aware matching and only uses before/after diffs when transaction lookup data is unavailable.
- Create-entry follow-up handling now preserves safer warning outcomes when Grocy merges stock into existing entries and no new transaction-owned rows are created.

### Fixed

- Explicit `bestBeforeDate: null` requests are now honored instead of defaulting to Grocy's implicit current-day due date.
- Post-mutation error handling now avoids false failures after successful stock additions, reducing duplicate-add risk on caller retries.

## [1.8.1] - 2026-04-04

This patch release fixes the stale Grocy entity update test and hardens the release pipeline so container publishing only happens after successful CI on the tagged commit.

### Changed

- Release preparation now requires the full local `npm test` suite and a successful `CI` workflow on the release commit before the release tag is pushed.
- The Docker publish workflow now refuses to start multi-platform image builds unless the tagged commit already has a successful `CI` workflow run.

### Fixed

- The Grocy entity update wrapper test now matches the merged editable `PUT` payload, including preserved nullable fields and filtered non-editable fields.
- Grocy update wrapper types now accept nullable `description` values where the implementation already preserves explicit clears.

## [1.8.0] - 2026-04-04

This minor release expands the MCP operational workflow with Grocy catalog management, deeper inventory entry controls, and more complete action-history coverage for write operations.

### Added

- MCP catalog CRUD tools for Grocy locations and product groups, so storage metadata can be managed directly from the MCP surface.
- MCP inventory entry listing, direct entry lookup, and entry update tools for more precise Grocy stock corrections.
- Action-history tracking for conversion create/delete operations to close the remaining audit gap for MCP mutations.

### Changed

- Duplicate-prevention outcomes across product, unit, conversion, and shopping mutations now return `status: "skipped"` so MCP clients can distinguish no-op safeguards from successful writes.
- Shared MCP schemas and helpers are centralized, and inventory/unit follow-up flows now preserve product context more consistently after mutations.

### Fixed

- Unit and inventory follow-up handling is tighter when previous operations reuse resolved product references, reducing stale-target behavior in chained MCP actions.

## [1.7.0] - 2026-04-03

This minor release adds a products listing MCP tool with stock and mapping filters, enriches product details with location, product group, and unit names, and extends the stock settings update tool to cover location, product group, and move-on-open fields.

### Added

- `products.list` MCP tool with filters for stock levels, location, product group, and mapping scope.
- Product overview now resolves Grocy location and product group names alongside unit names for purchase and stock units.

### Changed

- `products.update_grocy_stock_settings` now accepts `productGroupId`, `locationId`, `moveOnOpen`, and `defaultConsumeLocationId` to manage all core product options in one operation.
- Product details expose `moveOnOpen` and `defaultConsumeLocation` fields so the location-after-open setting is visible through the overview.

## [1.6.0] - 2026-04-01

This minor release adds shopping list cleanup automation, unit conversion and product management MCP tools, improved error visibility, and a project license.

### Added

- Shopping list cleanup with a manual trigger and daily scheduled job to remove resolved items from Mealie shopping lists.
- MCP tools for unit conversion management, product deletion, and unit lifecycle management.
- Product overview now enriches entries with relevant unit conversions for easier inspection.
- ISC license file added to the project.

### Changed

- History filters improved with better date range handling and more consistent filtering behavior.
- Product reference tools streamlined by removing redundant name-based lookup.
- Dashboard now displays the app version in the header for easier identification.

### Fixed

- Mealie API errors now surface actual error messages instead of generic descriptions, and redundant inventory correction steps are skipped.
- Grocy API errors now show real error responses instead of static OpenAPI descriptions.

## [1.5.0] - 2026-03-30

### Changed

- The `shopping.add_item` and `shopping.add_item_by_name` MCP tools are unified into a single `shopping.add_item` tool that accepts either a direct Mealie `foodId` or a `query` product name. The result now always includes a `resolved` field (`null` when using `foodId` directly, populated with resolution details when using `query`).

## [1.4.0] - 2026-03-30

This minor release expands the MCP operational workflow with smarter shopping-list item resolution, richer inventory stock controls, and tighter unit-selector filtering.

### Added

- A `shopping.add_item_by_name` MCP tool that can resolve exact product names directly onto the configured Mealie shopping list and, for inputs like `vanille kwark`, safely fall back to `kwark` while moving the leading words into the item note.
- MCP inventory add/set flows now accept opened-stock quantities, with matching action-history coverage and contract tests.

### Changed

- Shopping-list duplicate handling now preserves note context by joining note fragments with ` | ` instead of overwriting the existing note.
- Mapping wizard unit selectors now filter out stale default-unit mappings more consistently, and the unit-wizard filter dropdown behavior is more uniform.

### Fixed

- Conflict checks that only partially complete are now recorded as partial outcomes instead of appearing fully successful.
- Active unit-mapping lookups now guard settings and mapping-wizard flows more reliably when stale mappings are present.

## [1.3.0] - 2026-03-29

This minor release adds an optional HTTP MCP server for operational workflows, expands mapping wizard inventory controls, and improves UI polish and release tooling resilience.

### Added

- An HTTP MCP endpoint with product, unit, inventory, shopping, history, conflict, and diagnostics tools plus supporting MCP resources, prompts, action history, and documentation.
- Mapping wizard controls to edit mapped product current stock, update Grocy minimum stock from the reverse-mapping view, and refresh tab data without closing the wizard.
- Playwright coverage for manual action history, history search, mapping wizard refresh flows, mapped-products mobile behavior, MCP HTTP routes, and dark-mode settings selectors.

### Changed

- The dashboard header now shows the running app version, and startup logging now reports whether the MCP endpoint is enabled.
- History runs are sorted by newest completion, history search is debounced without dropping typed input, and settings selectors behave more reliably in dark mode.
- The docs screenshot workflow now hardens upstream service checks and falls back more reliably from `host.docker.internal` to local loopback addresses when needed.

### Fixed

- MCP inventory follow-up flows now resolve product references correctly for subsequent operations.
- Partial mapping wizard actions are now recorded as partial history runs instead of appearing fully successful.
- Smaller UI regressions, including the mobile width of the minimum-stock editor.
- Refreshed Drizzle migration metadata for the existing history tables so future schema generation stays aligned with the shipped SQLite schema.

## [1.2.1] - 2026-03-28

This patch release fixes the `v1.1.0` to `v1.2.0` SQLite upgrade path, adds startup version logging, and refreshes the release workflow metadata.

### Added

- Startup logging now includes the app name and version during Node.js boot.
- A root `AGENTS.md` file now documents the required release-prep workflow for changelog updates, screenshot generation, version bumps, and tagging.

### Changed

- Refreshed the bundled dashboard screenshot used in the project documentation.

### Fixed

- Upgrades from older databases now repair skipped SQLite objects by creating the missing `runtime_locks` table and unique indexes for `grocy_product_id` and `grocy_unit_id` when earlier out-of-order migration timestamps caused them to be skipped.
- Added regression coverage for the broken migration path so future releases keep the repair in place.

## [1.2.0] - 2026-03-28

This release substantially expands the mapping workflow, adds an audit trail for scheduler and manual actions, and improves operational controls without introducing a breaking change.

### Added

- A full sync history and audit log with richer event detail, broader manual action logging, and searchable action and trigger filters in the History UI.
- Major mapping wizard additions, including mapped products and units management, a Grocy minimum-stock mapping tab, conflict detection and remap flows, bulk suggestion helpers, and shortcuts from low-stock views into the wizard.
- Mealie in-possession syncing, scheduler failure notifications, manual lock recovery controls, configurable display timezone support, toggleable app authentication, and a global insecure TLS option.
- Maintenance tooling for compose/OpenAPI refresh workflows plus refreshed docs screenshots and local development setup improvements.

### Changed

- The mapping wizard now lazy-loads tabs, gives the Conflicts view more space, and keeps controls and dropdown behavior consistent across history, settings, and mapping screens.
- Minimum stock editing is now configured through a numeric step setting instead of a binary decimal toggle.
- Runtime SQLite access now routes through Drizzle-only data access, with SQLite-backed leases and a single active scheduler instance coordinating sync work.
- Grocy-to-Mealie ensure flows, partial outcome reporting, and history messaging are clearer and more actionable in the UI.

### Fixed

- Invalid nested button markup in settings and mapping wizard UI paths that could surface in the Next.js error overlay.
- Conflict migration edge cases, unique Grocy mapping assignment enforcement, and several sync error propagation gaps through routes and UI state.
- Smaller polish issues across history filters, mapping controls, and low-stock status handling.

## [1.1.0] - 2026-03-26

This release adds a manual “ensure low-stock” sync path and makes the docs screenshot workflow reproducible by generating the screenshot from a locally built production app.

### Added

- A new `POST /api/sync/grocy-to-mealie/ensure` endpoint and matching UI action to ensure current below-minimum Grocy products exist on the configured Mealie shopping list.
- A Playwright-based docs screenshot workflow, including the generated dashboard image and setup notes for local and remote Linux development environments.

### Changed

- The docs screenshot script now runs `next build` and starts the app locally in production mode before capturing the image, avoiding development-only UI artifacts in the exported screenshot.
- The README now documents the production-backed screenshot flow instead of a `next dev` capture path.

## [1.0.0] - 2026-03-25

This release promotes the current base to `1.0.0`. Compared with `v0.0.1`, the project is materially stronger in configuration handling, mapping workflow stability, and sync correctness.

### Added

- Full environment-backed settings parity for `MEALIE_SHOPPING_LIST_ID`, `GROCY_DEFAULT_UNIT_ID`, `AUTO_CREATE_PRODUCTS`, `AUTO_CREATE_UNITS`, and `STOCK_ONLY_MIN_STOCK`.
- Locked setting indicators in the web UI when environment variables override persisted values.
- A VS Code devcontainer with Node.js 24, Docker CLI access, and port `3000` forwarding.
- A dashboard screenshot plus expanded setup documentation for Docker, GHCR images, and devcontainer-based development.
- Regression tests for mapping wizard state, product sync routes, config/env handling, and Grocy entity update behavior.

### Changed

- The mapping wizard now preserves selected mappings and checkbox state after normalize, create, sync, and orphan-cleanup actions.
- Wizard layout behavior is more stable, with fixed dialog height, reliable internal scrolling, and searchable dropdowns that portal and reposition instead of overflowing.
- The settings screen now exposes auto-create and restock behavior consistently, including clear precedence between env vars and UI-managed values.
- The README and `.env.example` now document the current deployment path and operational settings more clearly.

### Fixed

- Product sync now correctly renames Grocy products to the Mealie name and stores the effective Grocy name in mappings.
- Grocy entity updates now merge onto the existing entity and only send editable fields, avoiding partial `PUT` payload breakage.
- Grocy-to-Mealie missing-stock handling now resolves the correct Grocy product name after sync-driven restocks.
- Settings resolution and validation now respect environment overrides consistently instead of mixing DB-first and env-first behavior.

## [0.0.1] - 2026-03-25

- First tagged preview release.

[1.9.0]: https://github.com/HarmEllis/grocy-mealie-sync/compare/v1.8.1...v1.9.0
[1.8.1]: https://github.com/HarmEllis/grocy-mealie-sync/compare/v1.8.0...v1.8.1
[1.8.0]: https://github.com/HarmEllis/grocy-mealie-sync/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/HarmEllis/grocy-mealie-sync/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/HarmEllis/grocy-mealie-sync/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/HarmEllis/grocy-mealie-sync/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/HarmEllis/grocy-mealie-sync/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/HarmEllis/grocy-mealie-sync/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/HarmEllis/grocy-mealie-sync/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/HarmEllis/grocy-mealie-sync/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/HarmEllis/grocy-mealie-sync/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/HarmEllis/grocy-mealie-sync/compare/v0.0.1...v1.0.0
[0.0.1]: https://github.com/HarmEllis/grocy-mealie-sync/tree/v0.0.1

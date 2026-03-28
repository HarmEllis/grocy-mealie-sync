# Changelog

All notable changes to this project are documented in this file.

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

[1.2.1]: https://github.com/HarmEllis/grocy-mealie-sync/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/HarmEllis/grocy-mealie-sync/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/HarmEllis/grocy-mealie-sync/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/HarmEllis/grocy-mealie-sync/compare/v0.0.1...v1.0.0
[0.0.1]: https://github.com/HarmEllis/grocy-mealie-sync/tree/v0.0.1

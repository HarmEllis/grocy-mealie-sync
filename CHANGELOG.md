# Changelog

All notable changes to this project are documented in this file.

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

[1.0.0]: https://github.com/HarmEllis/grocy-mealie-sync/compare/v0.0.1...v1.0.0
[0.0.1]: https://github.com/HarmEllis/grocy-mealie-sync/tree/v0.0.1

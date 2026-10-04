# Shared units and conversions

The **Units & Conversions** page (`/conversions`) provides a library of metric
and US customary definitions for Mealie and Grocy. Each entry shows its equation,
such as `1 kilogram = 1000 grams`. Definitions connect measurements to grams or
milliliters; Grocy supplies inverse and indirect conversions automatically.

## Install a preset

1. Select **Metric**, **US customary**, or individual entries. Search and filter
   by measurement system or dimension to narrow the library.
2. Choose **Mealie + Grocy** (the default) or **Grocy only**. Enable creation of
   missing units if you want the importer to propose new units.
3. Open **Review import**. Choose existing units where names are ambiguous, or
   choose to create a separately named unit. Review every proposed change.
4. Apply the reviewed changes. The result lists completed writes, existing
   conversions, and failures. Import activity also appears in **History**.

Shared setup requires **Mealie 3.13 or newer**, which supports native
`standardQuantity` and `standardUnit`. For example, a kilogram has
`standardQuantity: 1000` and `standardUnit: "gram"`. Grocy gets the corresponding
kilogram-to-gram conversion with factor `1000`. The app mapping connects the
equivalent kilogram units in the two systems with factor `1`.

The **Grocy only** target also works while Mealie is offline; it reads Grocy
units and definitions without requesting Mealie's catalog.

Existing Mealie standardization is reused when equivalent and blocks the import
when it differs. Existing names, aliases, display preferences, and other unit
metadata are preserved. Editing a Mealie unit through the existing unit tools
also preserves its native standardization fields.

These definitions enable each application's native conversions. The stock-sync
worker continues using its existing quantity handling; this feature does not
introduce automatic quantity conversion while transferring stock between apps.

## Ambiguity, conflicts, and retries

The US preset uses explicit US measures. **US cup** is approximately `236.588 mL`;
a generic `cup` may mean `250 mL` or another convention. Generic names such as
`cup`, `ounce`, or `tablespoon` require an explicit selection unless Mealie's
existing standardization identifies the measurement. Metric units use curated
English and Dutch aliases, with a choice required for multiple matches.

Metric tablespoons (`15 mL`) and teaspoons (`5 mL`) are not part of the current
catalog. Configure those as custom definitions; the US spoon entries use their
own measurements and do not match Dutch spoon aliases.

The preview checks direct, reverse, and indirect global Grocy conversions. It
blocks inconsistent paths and different existing factors instead of overwriting
them. Product-specific definitions remain separate. Floating-point comparisons
use a relative tolerance of `1e-8`; display rounding never changes stored factors.

If units or definitions change after preview, import returns `PREVIEW_STALE`
before writing. Review again to obtain a fresh fingerprint. Imports hold the
app's sync lock, so another sync or app write can return a busy response.

Upstream writes are separate API operations. A partial import retains completed
writes and reports failed steps. Request a fresh preview before retrying: units,
mappings, and definitions already present are reused. After a network timeout,
inspect upstream state and the fresh preview, since a remote write may have
succeeded before the connection failed.

## Custom definitions

The **Installed** tab groups Grocy's inverse records into one relationship and
shows global and product-specific definitions. **Custom conversion** accepts two
Grocy units, a positive factor, and an optional product. For example, define
`1 bottle = 750 milliliters` for a particular product. Deleting a relationship
also removes Grocy's generated inverse.

The library contains mass-to-mass and volume-to-volume definitions. Density
depends on the ingredient, so mass-to-volume or package-size conversions belong
to explicit product-specific definitions.

## REST API

All routes use the app's existing API authentication.

| Method and route | Result |
| --- | --- |
| `GET /api/conversions` | Installed definitions, unit catalogs, and product names; optional `target=grocy` skips Mealie |
| `POST /api/conversions` | Custom conversion using `fromGrocyUnitId`, `toGrocyUnitId`, `factor`, optional `grocyProductId` |
| `DELETE /api/conversions/[id]` | Delete the selected relationship |
| `GET /api/conversions/library` | Catalog; optional `query`, `system` (`metric` / `us`), `dimension` (`mass` / `volume`) |
| `POST /api/conversions/preview` | Read-only plan and fingerprint |
| `POST /api/conversions/import` | Per-step import result |

Example preview body:

```json
{
  "entryIds": ["kilogram-to-gram", "liter-to-milliliter"],
  "target": "both",
  "createMissingUnits": true,
  "bindings": {
    "kilogram": { "mealieUnitId": "your-mealie-unit-id", "grocyUnitId": 4 }
  }
}
```

Bindings are keyed by canonical library unit ID, as returned in the catalog and
preview. Each can select `mealieUnitId` / `grocyUnitId`, request `createMealie` /
`createGrocy`, and set `name` / `pluralName`. Choosing creation requires
`createMissingUnits: true`. Unit selections and creation for the same system are
mutually exclusive. New names must not collide with existing units.

To import, submit **exactly `preview.selection` plus `preview.fingerprint`**.
The preview reports `canImport`, per-unit problems, entry statuses, and counts
for unit creation, Mealie standardization, app mappings, and Grocy conversions.
Blocked plans and stale previews return HTTP `409` with a machine-readable code.
Invalid requests return `400`. Results use `success`, `partial`, `failure`, or
`skipped` and include every step with its status and confirmed object ID.

## MCP

Enable the existing MCP server with `MCP_ENABLED=true` and connect to `/api/mcp`.
The shared service is available through:

- `conversions.library.list`: browse/filter definitions and their stable IDs.
- `conversions.library.preview`: pass the same selection contract as REST; no writes.
- `conversions.library.import`: submit the reviewed selection and fingerprint.
- `gms://conversions/library`: read the bundled catalog.
- `gms://conversions/installed`: read current Grocy definitions.

For example: “Preview the metric conversions using my existing Mealie and Grocy
units. Show missing units and conflicts before importing.” The client lists
entries, previews, resolves choices, and imports the resulting fingerprint.
MCP returns structured stale/blocked errors and per-step partial results. A
retry requires a new preview. Existing `conversions.list`, `conversions.create`,
and `conversions.delete` remain available for individual custom definitions.

`units.create_mealie` and `units.update_mealie` accept paired
`standardQuantity` / `standardUnit` fields. Update accepts both as `null` to clear
standardization; partial pairs and non-positive quantities are rejected.

## Reference sources

- [NIST conversion factors](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors).
- [Mealie 3.13 native unit standardization](https://github.com/mealie-recipes/mealie/releases/tag/v3.13.0).
- [Mealie's eight standard unit values](https://github.com/mealie-recipes/mealie/blob/mealie-next/mealie/schema/recipe/recipe_ingredient.py).
- [Grocy inverse-conversion triggers](https://github.com/grocy/grocy/blob/v4.7.0/migrations/0188.sql).
- [Original feature request, issue #57](https://github.com/HarmEllis/grocy-mealie-sync/issues/57).

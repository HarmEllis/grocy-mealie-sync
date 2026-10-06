# Issue #57: shared conversion library

Status: approved scope implemented on `feat/shared-conversion-library`, 2026-10-04.

Issue: [Grocy Conversions #57](https://github.com/HarmEllis/grocy-mealie-sync/issues/57).

## Outcome

Provide one library to configure equivalent Mealie and Grocy units together.
Mealie supplies native standard quantities; Grocy supplies forward, inverse, and
indirect conversions. The app links equivalent units with identity mappings.
The default workflow previews both applications; a Grocy-only target supports
older Mealie installations. The same use-cases serve the web UI, REST, and MCP.

## Design decisions

- Bundle a versioned, verified catalog rather than executing the issue's PHP.
  Its requested coverage informs the catalog, but its incorrect and rounded
  factors are replaced with reference values.
- Ship 14 minimal definitions connecting 16 metric and US customary units to
  grams or milliliters. Preserve full precision and round only display values.
- Use explicit US names and require choices for ambiguous aliases. Preserve
  existing unit names and metadata. Require Mealie 3.13+ for shared setup.
- Reuse Mealie native `standardQuantity` / `standardUnit`. A kilogram is
  `1000 gram`; its equivalent cross-system mapping has factor `1`.
- Detect direct, reverse, and indirect global definitions before importing.
  Block conflicts, inconsistent paths, reused unit IDs, and conflicting
  mappings. Preserve product-specific definitions.
- Preview without writes. Import requires the exact reviewed selection and
  fingerprint, revalidates under the existing sync lock, and records partial
  results in history. Fresh previews reuse successful writes on retry.
- Use existing storage; the catalog is bundled and installed conversions remain
  in Grocy. No database migration is required.
- Keep automatic stock-sync quantity handling as its existing behavior. Native
  unit definitions do not introduce a new cross-system conversion worker.

## User experience

Add **Units & Conversions** to desktop and mobile navigation. The page has
**Library** and **Installed** tabs, preset cards, filters, readable equations,
status badges, and a sticky review action. The review dialog shows proposed
Mealie unit creation/standardization, Grocy unit creation, mappings, and
conversion definitions. Users select existing units or explicitly create missing
ones with editable names. Show blocked choices, stale previews, and completed
or failed steps. The Installed tab groups inverse relationships and supports
custom global/product conversions and confirmed deletion.

## Shared interfaces

| REST route | Purpose |
| --- | --- |
| `GET /api/conversions` | Installed conversions, units, and product names |
| `POST /api/conversions` | Create a custom conversion |
| `DELETE /api/conversions/[id]` | Delete a relationship and inverse |
| `GET /api/conversions/library` | Filter the bundled catalog |
| `POST /api/conversions/preview` | Resolve units and review proposed writes |
| `POST /api/conversions/import` | Apply the reviewed fingerprint |

MCP adds `conversions.library.list`, `.preview`, and `.import`, with
`gms://conversions/library` and `gms://conversions/installed` resources. Existing
custom-conversion tools remain available. Mealie unit tools gain native
standardization fields and preserve them on metadata edits.

## Verification and review

Cover reference values, ambiguous aliases, native standardization conflicts,
old Mealie capability, direct/reverse/indirect relationships, scope isolation,
stale previews, partial-success history, lock release, and safe retries. Exercise
REST error contracts and MCP tool/resource contracts. Browser coverage checks
preview/import, conflicts, inverse grouping, mobile layout, and light/dark mode.
Run `npm run typecheck`, `npm test`, and `npm run test:playwright`, then request
Claude review using `/co-dev review` and resolve its findings before handoff.

See [the conversion guide](../conversions.md) for the implemented contracts,
limitations, and reference sources.

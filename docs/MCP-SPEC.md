# Grocy-Mealie Sync - MCP Server Spec v0.2

> **Status**: DRAFT
> **Date**: 2026-03-28
> **Author**: Codex (draft), Joost (requirements)

---

## Purpose

This document defines an MCP server for the existing Grocy-Mealie Sync project.

The server is meant to support **daily operational work** through MCP-capable clients such as Open WebUI or Claude Desktop, not generic app administration.

The core idea is:

- manage products across Grocy and Mealie
- manage mappings and unit alignment
- manage inventory and shelf-life related product settings in Grocy
- manage Mealie shopping list items for error correction and daily use
- explain sync and mapping behavior when things do not line up

This MCP server is not a generic Grocy MCP server and not a generic Mealie MCP server. It is an operational layer over the combined Grocy + Mealie + sync-app workflow.

---

## Product Positioning

### What this MCP server is for

- creating and maintaining products
- mapping products and units
- adjusting stock and minimum stock
- setting shelf-life related product defaults in Grocy
- adding and removing shopping list items in Mealie
- diagnosing mapping and sync outcomes

### What this MCP server is not for

- editing sync-app settings as a primary workflow
- manually triggering syncs as a primary workflow
- duplicating the sync-app behavior that already pushes low-stock products to Mealie
- broad Grocy administration such as locations, product groups, or barcode administration in v1
- creating new units in v1

---

## Development Approach

This MCP server is intended to be built with **TDD first**.

That means:

- every capability starts with a failing test
- business behavior is tested before the MCP transport wiring
- MCP handlers stay thin and mostly translate validated input into use-case calls
- service-level behavior carries the real logic and therefore the real test weight

### Test layers

1. **Unit tests** for pure helper logic, normalization, duplicate detection, and merge rules.
2. **Service tests** for operational use-cases such as product creation, stock mutation, mapping changes, and shopping-list updates.
3. **MCP contract tests** for tool/resource schemas, response envelopes, and error handling.
4. **Integration tests** for orchestration against mocked Grocy and Mealie clients.
5. **Selective end-to-end workflow tests** for the highest-risk daily flows.

### TDD quality gates

A capability is not considered complete until:

- the failing test was written first
- the happy path passes
- the main error paths pass
- duplicate prevention behavior is covered where relevant
- response shapes are stable and asserted

---

## Functional Scope

## Out of Scope for the First Core Release

- sync-app settings management
- sync triggering as a normal user workflow
- unit creation
- low-stock push-to-list logic that is already owned by the sync app
- broad Grocy admin outside product-related workflows
- bulk actions in the first core release

## Must

### Product Management

- Search products by name across Grocy, Mealie, and existing mappings.
- Return a combined product overview with the relevant state from all three perspectives.
- Create a new product in Grocy only.
- Create a new product in Mealie only.
- Create a new product in Grocy and Mealie in one operation.
- When creating in both systems, create the mapping immediately.
- Check for likely duplicates in both systems before creation.
- Update product details needed for daily product and inventory management.

### Mapping Management

- List product mappings.
- Create, update, and remove product mappings.
- List unit mappings.
- Create, update, and remove unit mappings.
- List unmapped products and unmapped units.
- Show mapping suggestions.
- Show open mapping conflicts.
- Explain why a product is not mapped or why a mapping looks suspicious.

### Unit Management

- Work only with existing units in v1.
- Compare Grocy and Mealie units.
- Update unit naming metadata in Grocy and/or Mealie.
- Maintain plural forms and aliases so matching becomes more reliable.
- Normalize units so product creation and mapping suggestions improve over time.

### Inventory Management

- Get the current stock state of a product.
- Increase stock.
- Decrease stock.
- Set stock to an exact desired value.
- Add stock with amount, unit, best-before date, and note.
- Mark stock as opened.
- Answer practical questions such as "Do I have this?" and "What is almost out?"

### Grocy Product Stock Settings

- View and update `min_stock_amount`.
- View and update whether opened stock counts as out of stock via `treat_opened_as_out_of_stock`.
- View and update `default_best_before_days`.
- View and update `default_best_before_days_after_open`.
- View and update whether a product may be frozen via `should_not_be_frozen`.
- Manage the user's desired shelf-life model, including freezer-related days and due-date semantics, with implementation details to be validated against the target Grocy API version.

### Shopping List Management

- Check whether a product already exists on the Mealie shopping list.
- Add a product to the Mealie shopping list.
- Remove a product from the Mealie shopping list without checking it off.
- Search and inspect shopping list items for error correction.
- Prevent or merge duplicates on the shopping list.

### Diagnostics and Explainability

- Explain why a product was not processed as expected.
- Explain which mapping is active for a product.
- Explain why an item is considered a duplicate.
- Explain recent sync outcomes when they affect daily operations.

## Should

- Explain differences between Grocy and Mealie for one product.
- Suggest the best mapping candidate for unmapped items.
- Offer human-readable proposals before performing ambiguous write operations.
- Support natural-language daily requests that resolve to one safe operational action.

## Could

- Bulk mapping actions.
- Bulk product creation.
- Bulk stock corrections.
- Bulk minimum-stock updates.
- Bulk shopping-list corrections.
- Free-text to action-plan conversion for multi-item intake.

---

## v1 Delivery Scope

The first meaningful version should focus on:

- product search and combined product overview
- creating products in Grocy, Mealie, or both
- product and unit mapping management
- unit naming, plural, and alias management
- stock mutation workflows
- minimum stock and shelf-life related Grocy product settings
- Mealie shopping-list add/check/remove flows
- conflict and sync explanation

Explicitly not part of the first delivery:

- sync settings management
- manual sync triggers as a core user feature
- bulk operations
- broad Grocy admin features outside product operations

---

## MCP Surface

## Transport

### MVP: Streamable HTTP

The first version should ship as a Streamable HTTP MCP server exposed by the app itself.

Reasons:

- works for remote clients such as Claude Desktop, Claude Code, and Open WebUI
- matches the deployment model where this app runs as a long-lived server in Docker
- reuses the app's existing HTTP auth surface instead of requiring process-spawned local execution
- still supports local development by testing against the same HTTP endpoint

### Transport shape

The initial implementation should expose the MCP endpoint from the Next app, currently planned at `/api/mcp`.

For v1, stateless Streamable HTTP with JSON response mode is sufficient because the initial capabilities are request/response oriented:

- tool listing
- resource listing and reads
- synchronous tool calls for product lookup and duplicate analysis

If later capabilities need notifications, resumability, or long-running sessions, the transport can be extended to full stateful Streamable HTTP without changing the high-level MCP surface.

## Resources

Resources should cover stable read-heavy operational context.

### Direct resources

| URI | Purpose |
|-----|---------|
| `gms://status` | High-level operational status of the sync app |
| `gms://mappings/products` | Current product mappings |
| `gms://mappings/units` | Current unit mappings |
| `gms://products/unmapped` | Unmapped products across Grocy and Mealie |
| `gms://units/unmapped` | Unmapped units |
| `gms://units/catalog` | Current Grocy and Mealie unit catalogs |
| `gms://conflicts/open` | Current open mapping conflicts |
| `gms://shopping/items` | Current Mealie shopping-list items |
| `gms://inventory/low-stock` | Current low-stock product overview |
| `gms://history/recent` | Recent sync and manual operation history |

### Resource templates

| Template | Purpose |
|----------|---------|
| `gms://products/{productRef}` | Combined product overview for one product |
| `gms://history/runs/{runId}` | Detailed history run with events |

### Resource rules

- Resources must be read-only.
- Resources must not expose secrets.
- Resources may include a short summary block ahead of the main JSON payload.

## Tools

### Read tools

| Tool name | Purpose |
|-----------|---------|
| `products.search` | Search products across Grocy, Mealie, and mappings |
| `products.get_overview` | Return a combined product overview |
| `products.check_duplicates` | Check likely duplicate candidates before creation |
| `mappings.list_products` | Return product mappings |
| `mappings.list_units` | Return unit mappings |
| `mappings.list_unmapped` | Return unmapped products and units |
| `mappings.suggest_products` | Suggest likely product mappings for unmapped Mealie foods |
| `mappings.suggest_units` | Suggest likely unit mappings for unmapped Mealie units |
| `units.list_catalog` | Return Grocy and Mealie unit catalogs for comparison |
| `units.compare` | Compare one candidate unit pair across both systems |
| `conflicts.list` | Return open conflicts |
| `shopping.list_items` | Return shopping-list items |
| `inventory.get_stock` | Return stock state for one product |
| `inventory.list_low_stock` | Return low-stock products |
| `diagnostics.explain_product_state` | Explain mapping/sync/product state for one product |
| `history.list_runs` | Return recent history runs |
| `history.get_run` | Return one history run in detail |

### Mutating tools for v1

| Tool name | Purpose |
|-----------|---------|
| `products.create_grocy` | Create a product in Grocy |
| `products.create_mealie` | Create a product in Mealie |
| `products.create_in_both` | Create a product in Grocy and Mealie and map it |
| `products.update_basic` | Update product details needed for daily product management |
| `products.update_grocy_stock_settings` | Update Grocy stock and shelf-life related product defaults |
| `mappings.upsert_product` | Create or update a product mapping |
| `mappings.remove_product` | Remove a product mapping |
| `mappings.upsert_unit` | Create or update a unit mapping |
| `mappings.remove_unit` | Remove a unit mapping |
| `units.update_grocy` | Update Grocy unit metadata such as name or plural forms |
| `units.update_mealie` | Update Mealie unit metadata such as name, plural name, plural abbreviation, and aliases |
| `inventory.add_stock` | Add stock with quantity and optional best-before date |
| `inventory.consume_stock` | Decrease stock due to use/consumption |
| `inventory.set_stock` | Correct stock to an exact value |
| `inventory.mark_opened` | Mark stock as opened |
| `shopping.add_item` | Add an item to the Mealie shopping list |
| `shopping.remove_item` | Remove an item from the Mealie shopping list |
| `shopping.merge_duplicates` | Resolve duplicate shopping-list items |

### Deferred tools

- bulk mapping tools
- bulk stock correction tools
- bulk shopping-list tools
- sync trigger tools
- broad Grocy admin tools

## Prompts

| Prompt name | Purpose |
|-------------|---------|
| `create-new-product` | Walk through safe creation in Grocy, Mealie, or both |
| `review-unmapped-items` | Review unmapped products and units and suggest the next actions |
| `diagnose-product-state` | Explain why a product is in its current cross-system state |
| `process-shopping-fix` | Review one shopping-list issue before mutating it |
| `apply-stock-correction` | Turn a natural-language stock correction into one safe action |

---

## Tool Contract Principles

### Write tools must be explicit

Write tools must avoid vague behavior.

Examples:

- do not accept "fix this" without a clear target
- do not mutate on fuzzy matches without an explicit chosen candidate
- do not auto-merge duplicates without a deterministic merge rule

### Duplicate prevention is part of the contract

For product creation and shopping-list writes, duplicate prevention is not an implementation detail. It is a user-visible guarantee and must therefore be covered by tests and surfaced in results.

### Stable result envelope

All tools should return a normalized envelope:

```ts
interface McpActionResult<TSummary = unknown, TData = unknown> {
  ok: boolean;
  status: 'ok' | 'partial' | 'skipped' | 'busy' | 'error';
  message: string;
  summary?: TSummary;
  data?: TData;
}
```

For read tools, `status` should normally be `ok`.

For write tools, the envelope should make it obvious:

- what changed
- what was skipped
- whether duplicate prevention changed the outcome
- whether upstream Grocy or Mealie constraints blocked the action

---

## Suggested Internal Architecture

The MCP layer should remain thin.

Recommended structure:

```text
src/
  mcp/
    server.ts
    resources/
    tools/
    prompts/
  lib/
    use-cases/
      products/
      mappings/
      units/
      inventory/
      shopping/
      diagnostics/
```

### Design rule

- MCP handlers validate input
- MCP handlers call use-case services
- use-case services hold the business behavior
- clients for Grocy and Mealie stay behind the use-case layer

This structure keeps the TDD boundary clean and makes contract tests much easier to maintain.

---

## TDD Test Plan by Capability Area

### Products

- duplicate detection before creation
- create in Grocy only
- create in Mealie only
- create in both and map
- rollback/error reporting behavior when one side fails

### Mappings

- create/update/remove product mappings
- create/update/remove unit mappings
- conflict detection and explanation
- unmapped list generation

### Units

- Grocy unit rename/plural handling
- Mealie unit rename/plural/alias handling
- normalization behavior
- no accidental unit creation in v1

### Inventory

- add stock with best-before date
- consume stock
- exact stock correction
- mark opened
- opened-count behavior explanation
- minimum-stock updates
- shelf-life setting updates

### Shopping List

- add item
- remove item
- duplicate detection
- duplicate merge behavior
- find existing item before write

### Diagnostics

- explain missing mapping
- explain duplicate classification
- explain recent sync effect on one product
- explain cross-system mismatch

### MCP Contract

- schema validation
- stable envelopes
- read vs write distinction
- predictable error mapping

---

## Acceptance Criteria

- A user can manage products, mappings, unit metadata, stock, and shopping-list correction through MCP without touching sync-app settings.
- A user can create a product in Grocy, Mealie, or both in one guided workflow.
- A user can update Grocy stock-related product defaults relevant to daily household use.
- Shopping-list add/remove flows prevent or explain duplicates.
- The MCP layer provides practical explanations when mappings or sync outcomes are confusing.
- Every shipped capability is backed by TDD at the appropriate test layer.

---

## Open Validation Items

The following are approved functional wishes, but the exact implementation needs to be validated against the target upstream API versions:

1. freezer-related shelf-life days in Grocy
2. due-date semantics such as THT vs "houdbaar tot" in Grocy

If the target Grocy API version does not expose these directly, the implementation phase must decide whether to:

- map them through another supported field or workflow
- defer them
- or explicitly document them as unsupported by the current upstream API

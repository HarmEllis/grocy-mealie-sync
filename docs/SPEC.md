# Grocy-Mealie Sync — NLSpec v1.0

> **Status**: DRAFT — awaiting approval before development
> **Date**: 2026-03-20
> **Author**: Claude (spec), Joost (requirements)

---

## Purpose

We use two self-hosted applications for household management:

- **Mealie** — recipe management and shopping lists (leading system for products/units)
- **Grocy** — household inventory/stock management with barcode scanning

Currently these systems operate independently. When a product is consumed in Grocy (e.g. scanned as used) and drops below its minimum stock level, it only gets added to Grocy's shopping list. There is no bridge to Mealie's shopping list where we actually manage our grocery shopping. Conversely, when items are checked off in Mealie (purchased), the stock in Grocy is not updated.

**Goal**: Build a bi-directional sync service that bridges the gap between Grocy's inventory tracking and Mealie's shopping list management.

---

## Actors

| Actor | Description |
|-------|-------------|
| **User** | Household member who scans barcodes in Grocy and manages shopping in Mealie |
| **Grocy** | Self-hosted ERP/inventory system (PHP, REST API with OpenAPI 3.x spec) |
| **Mealie** | Self-hosted recipe/shopping list manager (Python/FastAPI, REST API with OpenAPI 3.0 spec) |
| **Sync Service** | The Next.js TypeScript application we are building |

---

## Behaviors

### 3.1 Product & Unit Synchronization (Mealie → Grocy)

**Mealie is the leading system** for product (food) and unit definitions.

| ID | Behavior | Details |
|----|----------|---------|
| B1.1 | Sync foods from Mealie to Grocy products | Map Mealie `foods` to Grocy `products` by name. Create missing products in Grocy. |
| B1.2 | Sync units from Mealie to Grocy quantity units | Map Mealie `units` to Grocy `quantity_units` by name/abbreviation. Create missing QUs in Grocy. |
| B1.3 | Maintain a mapping table | Store the bidirectional ID mapping (Mealie food ID ↔ Grocy product ID, Mealie unit ID ↔ Grocy QU ID) persistently. |
| B1.4 | Handle name conflicts gracefully | If a Mealie food name matches an existing Grocy product, link them (don't duplicate). Use fuzzy matching or aliases. |
| B1.5 | Periodic re-sync | Run product/unit sync on a configurable interval (default: every 6 hours) to catch manual additions in Mealie. |

### 3.2 Grocy Consume → Mealie Shopping List

When a product is consumed in Grocy and the stock drops below its `min_stock_amount`:

| ID | Behavior | Details |
|----|----------|---------|
| B2.1 | Detect stock-below-minimum events | After a consume event in Grocy, check if the product's stock is now below `min_stock_amount`. |
| B2.2 | Add item to Mealie shopping list | Look up the corresponding Mealie food via the mapping table. Add it to the configured Mealie shopping list with the correct quantity (deficit = `min_stock_amount - current_stock`) and unit. |
| B2.3 | Avoid duplicates on Mealie list | Before adding, check if the food is already on the Mealie shopping list (unchecked). If so, update the quantity instead of creating a duplicate. |
| B2.4 | Grocy shopping list behavior unchanged | The standard Grocy behavior (adding to its own shopping list) continues to work independently. We do not interfere with it. |

### 3.3 Mealie Check-off → Grocy Stock Addition

When an item is checked off (purchased) in Mealie's shopping list:

| ID | Behavior | Details |
|----|----------|---------|
| B3.1 | Detect checked items in Mealie | Detect when a shopping list item's `checked` field changes from `false` to `true`. |
| B3.2 | Add stock in Grocy | Look up the corresponding Grocy product via the mapping table. Call Grocy's `/api/stock/products/{id}/add` with the checked item's quantity and appropriate unit. If Mealie reports quantity `0` or omits it, treat that as `1` purchased item. |
| B3.3 | Handle unit conversion | If Mealie and Grocy use different quantity units for the same product, use the QU conversion table in Grocy or the mapping to convert correctly. |
| B3.4 | Remove from Grocy shopping list | After adding stock, delete the corresponding item from the Grocy shopping list (Grocy shopping list items have no `done` field — they must be deleted via `DELETE /api/objects/shopping_list/{id}`). |

---

## 4. Detection Strategy

Both Grocy and Mealie have limited event/webhook capabilities, so the sync service needs a pragmatic detection approach:

### 4.1 Grocy → Sync Service

**Polling Grocy's volatile endpoint** (only viable option — Grocy's OpenAPI spec has no webhook endpoints):
- Poll `GET /api/stock/volatile` on a short interval (e.g. every 30-60 seconds)
- The response contains a `missing_products` array with objects: `{ id, name, amount_missing, is_partly_in_stock }`
- Compare with previous poll to detect newly missing products
- `amount_missing` gives the exact deficit to add to Mealie's shopping list

### 4.2 Mealie → Sync Service

**Polling Mealie's shopping list**:
- Poll `GET /api/households/shopping/lists/{id}` on a short interval (e.g. every 30-60 seconds)
- Compare item `checked` states with previous poll to detect newly checked items
- Simple, reliable, no additional Mealie configuration needed

> Note: Mealie's Apprise-based notifiers don't fire on item check-offs, only on item additions — not useful for this use case.

---

## 5. Data Models

### 5.1 Product Mapping (persisted by sync service)

```typescript
interface ProductMapping {
  id: string;                    // Internal UUID
  mealieFood: {
    id: string;                  // Mealie food UUID
    name: string;                // Cached name for display/debugging
  };
  grocyProduct: {
    id: number;                  // Grocy product integer ID
    name: string;                // Cached name
  };
  unitMapping: UnitMapping;      // Associated unit mapping
  createdAt: Date;
  updatedAt: Date;
}
```

### 5.2 Unit Mapping (persisted by sync service)

```typescript
interface UnitMapping {
  id: string;
  mealieUnit: {
    id: string;                  // Mealie unit UUID
    name: string;
    abbreviation: string;
  };
  grocyUnit: {
    id: number;                  // Grocy QU integer ID
    name: string;
  };
  conversionFactor: number;      // 1.0 if units are equivalent
  createdAt: Date;
  updatedAt: Date;
}
```

### 5.3 Sync State (for polling-based detection)

```typescript
interface SyncState {
  lastGrocyPoll: Date;
  lastMealiePoll: Date;
  grocyBelowMinStock: Set<number>;        // Product IDs currently below min
  mealieCheckedItems: Map<string, boolean>; // Item ID → checked state
}
```

---

## 6. API Endpoints (Sync Service)

The sync service exposes a minimal API for configuration and monitoring:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/status` | Current sync status (last poll times, items in queue) |
| GET | `/api/mappings/products` | List all product mappings |
| POST | `/api/mappings/products` | Manually create/link a product mapping |
| DELETE | `/api/mappings/products/:id` | Remove a product mapping |
| GET | `/api/mappings/units` | List all unit mappings |
| POST | `/api/mappings/units` | Manually create/link a unit mapping |
| POST | `/api/sync/products` | Trigger immediate product/unit sync |
| POST | `/api/sync/grocy-to-mealie` | Trigger immediate Grocy→Mealie check |
| POST | `/api/sync/mealie-to-grocy` | Trigger immediate Mealie→Grocy check |
| POST | `/api/webhooks/grocy` | Webhook receiver for Grocy events (future) |
| POST | `/api/webhooks/mealie` | Webhook receiver for Mealie events (future) |

---

## 7. API Dependencies (External)

### 7.1 Grocy API (consumed by sync service)

| Purpose | Endpoint | Method |
|---------|----------|--------|
| List products | `GET /api/objects/products` | Enumerate all products with `min_stock_amount` |
| Get stock status | `GET /api/stock` | Current stock levels for all products |
| Get volatile stock | `GET /api/stock/volatile` | Products below min_stock, expiring, etc. |
| Get product stock detail | `GET /api/stock/products/{productId}` | Detailed stock info (includes stock_amount) |
| Add stock | `POST /api/stock/products/{productId}/add` | Add purchased quantity to stock |
| Add missing to shopping list | `POST /api/stock/shoppinglist/add-missing-products` | Bulk add below-min items (optional) |
| Add product to shopping list | `POST /api/stock/shoppinglist/add-product` | Add specific product to list |
| Remove product from shopping list | `POST /api/stock/shoppinglist/remove-product` | Remove product from list |
| List shopping list items | `GET /api/objects/shopping_list` | Current shopping list items |
| Delete shopping list item | `DELETE /api/objects/shopping_list/{objectId}` | Remove item (no `done` field) |
| List quantity units | `GET /api/objects/quantity_units` | All QUs for mapping |
| Create product | `POST /api/objects/products` | Create product during sync |
| Create quantity unit | `POST /api/objects/quantity_units` | Create QU during sync |

**Auth**: `GROCY-API-KEY` header

**Key Grocy data models** (from OpenAPI spec):

**Product** (Grocy):
```typescript
{
  id: number;
  name: string;
  description?: string;
  location_id?: number;
  qu_id_purchase?: number;        // QU for purchasing
  qu_id_stock?: number;           // QU for stock tracking
  min_stock_amount: number;       // default: 0, minimum: 0
  product_group_id?: number;
  shopping_location_id?: number;
  enable_tare_weight_handling?: number;  // 0|1
  tare_weight?: number;
  userfields?: object;
}
```

**ShoppingListItem** (Grocy):
```typescript
{
  id: number;
  shopping_list_id: number;       // Grocy supports multiple lists
  product_id?: number;            // nullable — can be freetext note if null
  note?: string;
  amount: number;                 // default: 0
  userfields?: object;
  // NOTE: No `done` field — items are deleted when purchased
}
```

**QuantityUnit** (Grocy):
```typescript
{
  id: number;
  name: string;
  name_plural?: string;
  description?: string;
  plural_forms?: string;
  userfields?: object;
}
```

**CurrentVolatileStockResponse** (GET /api/stock/volatile):
```typescript
{
  due_products: CurrentStockResponse[];
  overdue_products: CurrentStockResponse[];
  expired_products: CurrentStockResponse[];
  missing_products: {
    id: number;
    name: string;
    amount_missing: number;
    is_partly_in_stock: number;   // 0|1
  }[];
}
```

**Stock Add Request** (POST /api/stock/products/{productId}/add):
```typescript
{
  amount: number;                 // REQUIRED
  best_before_date?: string;      // "YYYY-MM-DD"
  transaction_type?: string;      // "purchase" | "inventory-correction"
  price?: number;
  location_id?: number;
  shopping_location_id?: number;
  note?: string;
}
```

### 7.2 Mealie API v3.12.0 (consumed by sync service)

| Purpose | Endpoint | Method |
|---------|----------|--------|
| List foods | `GET /api/foods` | Enumerate all foods (paginated) |
| Create food | `POST /api/foods` | Create food if needed |
| Get food | `GET /api/foods/{item_id}` | Get single food by UUID |
| List units | `GET /api/units` | Enumerate all units (paginated) |
| Create unit | `POST /api/units` | Create unit if needed |
| Get unit | `GET /api/units/{item_id}` | Get single unit by UUID |
| Get shopping list | `GET /api/households/shopping/lists/{item_id}` | Full list with all items (ShoppingListOut) |
| List shopping list items | `GET /api/households/shopping/items` | All items (paginated, filterable) |
| Create shopping list item | `POST /api/households/shopping/items` | Add item to list (ShoppingListItemCreate) |
| Create many items | `POST /api/households/shopping/items/create-bulk` | Bulk add items |
| Update shopping list item | `PUT /api/households/shopping/items/{item_id}` | Update quantity, checked status, etc. |
| Update many items | `PUT /api/households/shopping/items` | Bulk update (ShoppingListItemUpdateBulk[]) |
| Delete shopping list item | `DELETE /api/households/shopping/items/{item_id}` | Remove item |

**Auth**: OAuth2 Bearer token via `Authorization: Bearer <token>` header. Token obtained from `POST /api/auth/token`.

**Key Mealie data models** (from OpenAPI spec):

**ShoppingListItemCreate** (used to add items):
```typescript
{
  shoppingListId: string;     // REQUIRED - UUID of target list
  checked: boolean;           // default: false
  quantity: number;           // default: 1
  foodId?: string;            // UUID - reference existing food
  unitId?: string;            // UUID - reference existing unit
  food?: IngredientFood | CreateIngredientFood | null;  // inline food
  unit?: IngredientUnit | CreateIngredientUnit | null;   // inline unit
  note?: string;              // default: ""
  position?: number;          // default: 0
  labelId?: string;           // UUID - label/category
  extras?: object;            // custom key-value data
  recipeReferences?: [];      // recipe origin tracking
}
```

**IngredientFood** (food/product in Mealie):
```typescript
{
  id: string;                 // UUID
  name: string;               // REQUIRED
  pluralName?: string;
  description?: string;
  labelId?: string;           // UUID - category label
  aliases?: { name: string }[];
  extras?: object;
}
```

**IngredientUnit** (unit of measure in Mealie):
```typescript
{
  id: string;                 // UUID
  name: string;               // REQUIRED
  pluralName?: string;
  abbreviation?: string;      // e.g., "g", "ml"
  pluralAbbreviation?: string;
  useAbbreviation?: boolean;  // default: false
  fraction?: boolean;         // default: true (supports 1/2, 1/4, etc.)
  aliases?: { name: string }[];
  extras?: object;
}
```

---

## 8. Technical Architecture

### 8.1 Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict mode) |
| API Clients | Generated from OpenAPI specs (using `openapi-typescript-codegen` or `openapi-fetch`) |
| Persistence | SQLite via Drizzle ORM (lightweight, file-based, no external DB needed) |
| Scheduling | Node.js `setInterval` or `node-cron` for polling loops |
| Deployment | Docker container (alongside Grocy and Mealie) |
| Config | Environment variables (API URLs, keys, polling intervals) |

### 8.2 Project Structure

```
grocy-mealie-sync/
├── src/
│   ├── app/                      # Next.js app router
│   │   ├── api/                  # API routes (health, status, mappings, sync, webhooks)
│   │   ├── page.tsx              # Dashboard UI (status, mappings overview)
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── grocy/                # Grocy API client (generated from OpenAPI)
│   │   │   ├── client.ts
│   │   │   └── types.ts
│   │   ├── mealie/               # Mealie API client (generated from OpenAPI)
│   │   │   ├── client.ts
│   │   │   └── types.ts
│   │   ├── sync/                 # Core sync logic
│   │   │   ├── product-sync.ts   # B1.x: Product/unit synchronization
│   │   │   ├── grocy-to-mealie.ts # B2.x: Consume → shopping list
│   │   │   ├── mealie-to-grocy.ts # B3.x: Check-off → stock addition
│   │   │   └── state.ts          # Polling state management
│   │   ├── db/                   # Database schema and queries
│   │   │   ├── schema.ts         # Drizzle schema (mappings, sync state)
│   │   │   └── index.ts
│   │   └── config.ts             # Environment variable parsing
│   ├── workers/                  # Background polling workers
│   │   ├── grocy-poller.ts
│   │   └── mealie-poller.ts
│   └── openapi/                  # Downloaded OpenAPI specs
│       ├── grocy.openapi.json
│       └── mealie.openapi.json
├── drizzle/                      # DB migrations
├── docker-compose.yml            # For running alongside Grocy/Mealie
├── Dockerfile
├── .env.example
├── package.json
└── tsconfig.json
```

### 8.3 Configuration (Environment Variables)

```env
# Grocy
GROCY_URL=http://grocy:9283
GROCY_API_KEY=your-grocy-api-key

# Mealie
MEALIE_URL=http://mealie:9925
MEALIE_API_TOKEN=your-mealie-bearer-token
MEALIE_SHOPPING_LIST_ID=uuid-of-target-shopping-list

# Sync Settings
POLL_INTERVAL_SECONDS=60
PRODUCT_SYNC_INTERVAL_HOURS=6

# Database
DATABASE_PATH=./data/sync.db
```

---

## Dependencies

| Dependency | Version/Type | Purpose |
|-----------|-------------|---------|
| Grocy REST API | OpenAPI 3.x (spec in `docs/grocy.openapi.json`) | Stock management, shopping list, products, quantity units |
| Mealie REST API | v3.12.0, OpenAPI 3.0 (spec in `docs/mealie.openapi.json`) | Shopping lists, foods, units |
| Next.js | 15.x | Application framework (App Router) |
| TypeScript | 5.x (strict mode) | Type-safe implementation |
| Drizzle ORM | latest | SQLite database access for mapping tables |
| SQLite | embedded | Persistent storage for mappings and sync state |
| Docker | latest | Deployment alongside Grocy and Mealie |
| node-cron or setInterval | N/A | Polling scheduler |
| openapi-typescript-codegen or openapi-fetch | latest | Typed API client generation from OpenAPI specs |

### Preconditions

- Grocy instance is reachable and has a valid API key configured
- Mealie instance is reachable and has a valid OAuth2 Bearer token
- A target Mealie shopping list exists (UUID configured via env var)
- Network connectivity between sync service, Grocy, and Mealie (typically same Docker network)
- OpenAPI specs for both services are available in `docs/`

### Postconditions

- All Mealie foods and units are mapped to corresponding Grocy products and quantity units
- Products below `min_stock_amount` in Grocy appear on the configured Mealie shopping list
- Items checked off in Mealie result in stock additions in Grocy and removal from Grocy's shopping list

---

## Acceptance

| ID | Criterion | Verification |
|----|-----------|-------------|
| A1 | Product sync creates Grocy products for all Mealie foods | After sync, every Mealie food has a corresponding Grocy product entry |
| A2 | Unit sync creates Grocy QUs for all Mealie units | After sync, every Mealie unit has a corresponding Grocy quantity unit |
| A3 | Consuming a product in Grocy below min_stock adds it to Mealie shopping list | Scan/consume an item in Grocy → within 1 polling interval, item appears on Mealie list with correct quantity and unit |
| A4 | Duplicate items are not created on Mealie list | Consuming the same product multiple times does not create duplicate Mealie shopping list items — quantity is updated instead |
| A5 | Checking off an item in Mealie adds stock in Grocy | Check item in Mealie → within 1 polling interval, Grocy stock increases by the item's quantity |
| A6 | Checked Mealie item triggers Grocy shopping list cleanup | After stock addition, the corresponding Grocy shopping list item is deleted |
| A7 | Sync service does not modify Mealie items | Mealie shopping list items are never updated or deleted by the sync service |
| A8 | Unmapped items are skipped gracefully | Note-only items or items without food references in Mealie are ignored without errors |
| A9 | Service recovers from restart | After restart, sync state is rebuilt from current API state without duplicate actions |
| A10 | Dashboard shows current status | Health endpoint returns 200, status endpoint shows last poll times and error count |

---

## 9. Sync Flow Diagrams

### 9.1 Grocy Consume → Mealie Shopping List

```
User scans barcode in Grocy (consumes product)
        │
        ▼
Grocy deducts stock internally
        │
        ▼
Sync Service polls GET /api/stock/volatile
        │
        ▼
Detects product X is now in "missing_products"
(was not in previous poll, has amount_missing > 0)
        │
        ▼
Looks up product X in mapping table
        │
        ├── Not found? → Log warning, skip
        │
        ▼
Found Mealie food ID
        │
        ▼
Check Mealie shopping list for existing unchecked item with same food
        │
        ├── Exists? → Update quantity (add deficit)
        │
        ▼
Doesn't exist → POST new item to Mealie shopping list
  { food: { id: mapped_food_id }, unit: { id: mapped_unit_id },
    quantity: min_stock_amount - current_stock, checked: false }
```

### 9.2 Mealie Check-off → Grocy Stock Addition

```
User checks item as purchased in Mealie
        │
        ▼
Sync Service polls GET /api/households/shopping/lists/{id}
        │
        ▼
Detects item Y changed from checked=false to checked=true
(by comparing with cached state)
        │
        ▼
Looks up item Y's food in mapping table
        │
        ├── Not found? → Log warning, skip (manual/recipe item, not synced)
        │
        ▼
Found Grocy product ID
        │
        ▼
POST /api/stock/products/{grocy_id}/add
  { amount: item.quantity, best_before_date: "2999-12-31",
    transaction_type: "purchase" }
        │
        ▼
Delete corresponding Grocy shopping list item
(DELETE /api/objects/shopping_list/{id})
```

### 9.3 Product/Unit Sync (Mealie → Grocy)

```
Scheduled trigger (every 6 hours) or manual trigger
        │
        ▼
Fetch all Mealie units (GET /api/units, paginated)
        │
        ▼
For each Mealie unit:
  ├── Exists in mapping table? → Check name still matches, update if needed
  └── New? → Search Grocy QUs by name
       ├── Found match? → Create mapping
       └── No match? → Create QU in Grocy, then create mapping
        │
        ▼
Fetch all Mealie foods (GET /api/foods, paginated)
        │
        ▼
For each Mealie food:
  ├── Exists in mapping table? → Check name still matches, update if needed
  └── New? → Search Grocy products by name
       ├── Found match? → Create mapping
       └── No match? → Create product in Grocy (with default min_stock=0), then create mapping
```

---

## Constraints

| # | Constraint/Assumption |
|---|----------------------|
| C1 | Mealie is the source of truth for product names and units. Products created in Grocy-only won't sync to Mealie automatically. |
| C2 | The sync service requires both Grocy and Mealie to be reachable on the network (typically same Docker network). |
| C3 | A single Mealie shopping list is designated as the sync target (configurable via env var). |
| C4 | Grocy's `min_stock_amount` must be configured manually per product. Products synced from Mealie are created with `min_stock_amount=0` (inactive until user sets a threshold). |
| C5 | The sync service does NOT consume products in Grocy — that is done by the user via Grocy's UI/barcode scanning. |
| C6 | The sync service does NOT check off items in Mealie — that is done by the user while shopping. |
| C7 | Polling introduces a small delay (up to 1 polling interval). This is acceptable for a household use case. |
| C8 | The service should handle both systems being temporarily unavailable (retry with backoff). |
| C9 | No user authentication on the sync service dashboard (it runs in a trusted home network). |
| C10 | Product matching between systems is name-based. Users should ensure consistent naming in Mealie. |
| C11 | Grocy starts empty. Initial sync populates Grocy from Mealie's existing foods and units. |
| C12 | The sync service only reads Mealie's `checked` state — it never modifies or deletes Mealie shopping list items. |
| C13 | Default Grocy shopping list (id=1) is used for all operations. |

---

## 11. Edge Cases

| # | Scenario | Handling |
|---|----------|----------|
| E1 | Product exists in Grocy but not Mealie | Not synced. Log informational message. User should add food in Mealie (leading system). |
| E2 | Multiple Grocy products match one Mealie food | Map to the first match. Provide UI to manually adjust mappings. |
| E3 | Item checked and then unchecked in Mealie between polls | If polling catches the checked state → stock is added. The uncheck won't reverse it (by design — user should manage this). |
| E4 | Same product drops below min multiple times between polls | Only one shopping list item should exist. Check for duplicates before adding. |
| E5 | Mealie shopping list item has no associated food (note-only item) | Skip — can't map to Grocy product. |
| E6 | Unit mismatch (Mealie uses "stuks", Grocy uses "Stück") | Name-based matching with normalization. Provide manual mapping override in dashboard. |
| E7 | Grocy or Mealie API is unreachable | Retry with exponential backoff. Show error in dashboard. Don't lose pending sync actions (persist queue). |
| E8 | Sync service restarts | Rebuild state from current API state on startup (fetch current stock volatile + shopping list state). |

---

## 12. Dashboard UI (Minimal)

A simple Next.js page showing:

1. **Status Panel**: Last sync times, polling status (running/stopped), error count
2. **Product Mappings Table**: Mealie food ↔ Grocy product, with ability to unlink/relink
3. **Unit Mappings Table**: Mealie unit ↔ Grocy QU, with conversion factor
4. **Sync Log**: Recent sync actions (what was added/updated and when)
5. **Manual Actions**: Buttons to trigger immediate sync for each direction

---

## 13. Development Phases

### Phase 1: Foundation & API Clients
- Set up Next.js project with TypeScript
- Download and integrate OpenAPI specs from both services
- Generate typed API clients
- Set up SQLite database with Drizzle ORM
- Implement configuration management
- Basic health/status endpoint

### Phase 2: Product & Unit Sync (B1.x)
- Implement Mealie food → Grocy product sync
- Implement Mealie unit → Grocy QU sync
- Mapping table CRUD
- Name matching logic with normalization
- Scheduled sync job

### Phase 3: Grocy → Mealie Flow (B2.x)
- Implement Grocy stock volatile polling
- Detect below-min-stock changes
- Add items to Mealie shopping list
- Duplicate detection on Mealie list
- State management for poll comparison

### Phase 4: Mealie → Grocy Flow (B3.x)
- Implement Mealie shopping list polling
- Detect checked-off items
- Add stock in Grocy
- Delete Grocy shopping list items after stock addition
- State management for poll comparison

### Phase 5: Dashboard & Polish
- Build dashboard UI
- Manual mapping management
- Sync log display
- Manual trigger buttons
- Docker setup (Dockerfile + docker-compose)
- Documentation

### Phase 6: Future Enhancements (optional)
- Barcode-based product matching (Grocy has `product_barcodes` entity + `/api/stock/products/by-barcode/{barcode}`)
- Unit conversion support (Grocy has `quantity_unit_conversions` entity)
- Multi-shopping-list support
- Home Assistant integration

---

## 14. Open Questions — Resolved

| # | Question | Answer |
|---|----------|--------|
| Q1 | Which Mealie version? | **v3.12.0** — uses `/api/households/` prefix |
| Q2 | Default `min_stock_amount` for synced products? | **Always set manually in Grocy.** Sync creates products with `min_stock_amount=0` (ignored until user configures it). |
| Q3 | Cleanup after Mealie check-off? | **Sync service does NOT touch Mealie items.** It only reads `checked` state. User manages Mealie list naturally. Sync service only acts on the Grocy side (add stock + delete Grocy shopping list item). |
| Q4 | Multiple Grocy shopping lists? | **Only default list** (id=1). |
| Q5 | Dashboard language? | **English.** |
| Q6 | Starting state? | **Grocy is empty, Mealie has existing data.** Initial sync will populate Grocy products/units from Mealie. |

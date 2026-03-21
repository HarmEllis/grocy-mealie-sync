# Grocy-Mealie Sync

Bi-directional sync service between [Grocy](https://grocy.info/) (inventory management) and [Mealie](https://mealie.io/) (meal planning / shopping lists).

## What it does

1. **Product & unit sync** — Matches products and units between Grocy and Mealie by name. Creates missing items in Grocy automatically.
2. **Grocy → Mealie** — When stock drops below minimum in Grocy, the item is added to your Mealie shopping list.
3. **Mealie → Grocy** — When you check off an item on the Mealie shopping list, stock is added in Grocy and the item is removed from Grocy's shopping list.

The service polls both APIs on a configurable interval (default: 60 seconds).

## Prerequisites

- A running **Grocy** instance (tested with Grocy 4.x)
- A running **Mealie** instance (tested with Mealie v3.12.0)
- **Node.js 22+** (for local dev) or **Docker**

## Setup

### 1. Get API credentials

**Grocy API key:**
- Go to Grocy → Settings (gear icon) → Manage API keys → Add

**Mealie API token:**
- Go to Mealie → User Settings → API Tokens → Create Token

**Mealie Shopping List ID:**
- Open your shopping list in Mealie
- The UUID is in the URL: `https://mealie.example.com/shopping-lists/<this-uuid>`

### 2. Configure environment

Copy the example and fill in your values:

```bash
cp .env.example .env
```

```env
# Grocy
GROCY_URL=http://grocy:9283          # Base URL, no trailing slash
GROCY_API_KEY=your-grocy-api-key

# Mealie
MEALIE_URL=http://mealie:9925        # Base URL, no trailing slash
MEALIE_API_TOKEN=your-mealie-bearer-token
MEALIE_SHOPPING_LIST_ID=uuid-of-target-shopping-list

# Sync Settings
POLL_INTERVAL_SECONDS=60             # How often to poll (default: 60)
PRODUCT_SYNC_INTERVAL_HOURS=6        # How often to re-sync products (default: 6)
# GROCY_DEFAULT_UNIT_ID=3            # Fallback unit ID for new Grocy products (optional, can be set in web UI)
STOCK_ONLY_MIN_STOCK=true            # Only add stock for products with min_stock_amount > 0

# Database
DATABASE_PATH=./data/sync.db         # SQLite database path
```

### 3. Run

**With Docker (recommended):**

```bash
docker build -t grocy-mealie-sync .
docker run -d \
  --name grocy-mealie-sync \
  --env-file .env \
  -p 3000:3000 \
  -v grocy-mealie-sync-data:/app/data \
  grocy-mealie-sync
```

**With Docker Compose:**

```yaml
services:
  grocy-mealie-sync:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    volumes:
      - sync-data:/app/data
    restart: unless-stopped

volumes:
  sync-data:
```

**Local development:**

```bash
npm install
npm run dev
```

The app runs on `http://localhost:3000`.

## Verifying it works

1. Open `http://localhost:3000` — you should see the status dashboard with sync status and settings
2. Check `GET /api/status`:
   - `productMappings` / `unitMappings` should show counts after the initial sync
   - `lastGrocyPoll` / `lastMealiePoll` should update every poll interval

If polls are not updating, check the container/server logs for errors (likely API connection issues).

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/status` | Poll timestamps, mapping counts |
| `GET` | `/api/settings` | Current settings and available units |
| `PUT` | `/api/settings` | Update settings (e.g. default unit) |
| `GET` | `/api/mappings/products` | All product mappings (Mealie food ↔ Grocy product) |
| `GET` | `/api/mappings/units` | All unit mappings (Mealie unit ↔ Grocy unit) |
| `POST` | `/api/sync/products` | Manually trigger product & unit sync |
| `POST` | `/api/sync/grocy-to-mealie` | Manually trigger Grocy → Mealie poll |
| `POST` | `/api/sync/mealie-to-grocy` | Manually trigger Mealie → Grocy poll |

Manual triggers are useful for testing. The scheduler runs these automatically.

## How the sync works

### Startup
1. Database migrations run automatically
2. Products and units are matched between Grocy and Mealie by name (case-insensitive)
3. Unmatched Mealie items are created in Grocy
4. Mappings are stored in SQLite for subsequent syncs

### Grocy → Mealie (stock below minimum)
- Polls Grocy's volatile stock endpoint for `missing_products`
- Newly missing products are added to the configured Mealie shopping list
- If the item already exists (unchecked) on the list, the quantity is updated instead of creating a duplicate

### Mealie → Grocy (shopping list check-off)
- Polls Mealie shopping list items for `checked: true` state changes
- Checked items add stock in Grocy (`purchase` transaction)
- The item is also removed from Grocy's shopping list
- Un-checking an item is ignored (no stock removal)
- Items without a linked food (ad-hoc notes) are skipped

## Settings

The default unit for newly created Grocy products can be configured in the web UI at `http://localhost:3000`. The dropdown shows units that were synced from Mealie. Resolution priority:

1. **Web UI setting** (stored in the database)
2. **`GROCY_DEFAULT_UNIT_ID`** environment variable (fallback)
3. **First available unit** (if neither is set)

## Grocy setup tips

For the Grocy → Mealie flow to work, your Grocy products need a `min_stock_amount` greater than 0. When current stock falls below this, the product appears in `missing_products` and gets synced to Mealie.

## Data

All sync state is stored in a SQLite database at the configured `DATABASE_PATH`. The database contains:
- **product_mappings** — Links between Mealie foods and Grocy products
- **unit_mappings** — Links between Mealie units and Grocy quantity units
- **sync_state** — Last poll timestamps, tracked checked items, app settings

The database is created automatically on first run.

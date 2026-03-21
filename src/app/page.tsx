import { getSyncState } from '@/lib/sync/state';
import { db } from '@/lib/db';
import { productMappings, unitMappings } from '@/lib/db/schema';
import { count } from 'drizzle-orm';

async function getStatus() {
  try {
    const state = await getSyncState();
    const [productCount] = await db.select({ count: count() }).from(productMappings);
    const [unitCount] = await db.select({ count: count() }).from(unitMappings);

    return {
      lastGrocyPoll: state.lastGrocyPoll,
      lastMealiePoll: state.lastMealiePoll,
      grocyBelowMinStockCount: Object.keys(state.grocyBelowMinStock).length,
      mealieTrackedItemsCount: Object.keys(state.mealieCheckedItems).length,
      productMappings: productCount.count,
      unitMappings: unitCount.count,
    };
  } catch {
    return null;
  }
}

export const dynamic = 'force-dynamic';

export default async function Home() {
  const status = await getStatus();

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1>Grocy-Mealie Sync</h1>
      <p>Bi-directional sync between Grocy inventory and Mealie shopping lists.</p>

      <h2>Status</h2>
      {status ? (
        <pre style={{ background: '#fff', padding: '1rem', borderRadius: 8, overflow: 'auto' }}>
          {JSON.stringify(status, null, 2)}
        </pre>
      ) : (
        <p>Could not fetch status. The sync service may not be running.</p>
      )}

      <h2>API Endpoints</h2>
      <ul>
        <li><code>GET /api/health</code> — Health check</li>
        <li><code>GET /api/status</code> — Sync status</li>
        <li><code>GET /api/mappings/products</code> — Product mappings</li>
        <li><code>GET /api/mappings/units</code> — Unit mappings</li>
        <li><code>POST /api/sync/products</code> — Trigger product sync</li>
        <li><code>POST /api/sync/grocy-to-mealie</code> — Trigger Grocy→Mealie check</li>
        <li><code>POST /api/sync/mealie-to-grocy</code> — Trigger Mealie→Grocy check</li>
      </ul>
    </div>
  );
}

import { PluginClient } from '../lib/client.ts';
import { DemoAdapter } from './demo.ts';

const url = process.env.GM_SYNC_URL;
const token = process.env.GM_SYNC_PLUGIN_TOKEN;
if (!url || !token) throw new Error('Configure GM_SYNC_URL and GM_SYNC_PLUGIN_TOKEN.');
const dataDir = process.env.PLUGIN_DATA_DIR ?? '/data';
const adapter = await new DemoAdapter(dataDir, process.env.DEMO_AUTHENTICATED === 'true').init();
const client = new PluginClient(adapter, { url, token, dataDir });
process.once('SIGINT', () => client.stop());
process.once('SIGTERM', () => client.stop());
await client.start();

import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createGrocyMealieSyncMcpServer } from '../server';
import { ConversionLibraryError, previewConversionImport } from '@/lib/use-cases/conversions/library';
import type { ImportResult } from '@/lib/conversions/contracts';

describe('shared conversion MCP contracts', () => {
  it('exposes catalog, preview, import and resources through a real MCP session', async () => {
    const preview = await previewConversionImport({ entryIds: ['kilogram-to-gram'], createMissingUnits: true }, { readState: async () => ({ grocyUnits: [], mealieUnits: [], mappings: [], conversions: [] }) });
    const previewService = vi.fn(async () => preview);
    const importService = vi.fn(async (): Promise<ImportResult> => ({ status: 'success', steps: [], created: 7, failed: 0 }));
    const server = createGrocyMealieSyncMcpServer({ conversionLibrary: { previewConversionImport: previewService, importConversionLibrary: importService } });
    const client = new Client({ name: 'conversion-test', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport); await client.connect(clientTransport);
    try {
      const catalog = await client.callTool({ name: 'conversions.library.list', arguments: { system: 'metric', dimension: 'mass' } });
      expect(catalog.structuredContent).toMatchObject({ ok: true, data: { version: '1', entries: [{ id: 'milligram-to-gram' }, { id: 'kilogram-to-gram' }] } });
      const response = await client.callTool({ name: 'conversions.library.preview', arguments: { entryIds: ['kilogram-to-gram'], createMissingUnits: true } });
      expect(response.structuredContent).toMatchObject({ ok: true, data: { fingerprint: preview.fingerprint, canImport: true } });
      await client.callTool({ name: 'conversions.library.import', arguments: { ...preview.selection, fingerprint: preview.fingerprint } });
      expect(importService).toHaveBeenCalledWith({ ...preview.selection, fingerprint: preview.fingerprint });
      const resources = await client.listResources();
      expect(resources.resources.map(r => r.uri)).toContain('gms://conversions/library');
      const resource = await client.readResource({ uri: 'gms://conversions/library' });
      expect(JSON.parse((resource.contents[0] as { text: string }).text).version).toBe('1');
      const tools = await client.listTools();
      expect(tools.tools.find(t => t.name === 'conversions.library.preview')?.annotations?.readOnlyHint).toBe(true);
      expect(tools.tools.find(t => t.name === 'conversions.create')).toBeDefined();
      vi.mocked(importService).mockResolvedValueOnce({ status: 'partial', steps: [], created: 2, failed: 1 });
      const partial = await client.callTool({ name: 'conversions.library.import', arguments: { ...preview.selection, fingerprint: preview.fingerprint } });
      expect(partial.isError).toBe(true);
      expect(partial.structuredContent).toMatchObject({ ok: false, status: 'partial', data: { created: 2, failed: 1 } });
    } finally { await client.close(); await server.close(); }
  });
  it('returns recoverable stale-preview errors and rejects imports without fingerprints', async () => {
    const importService = vi.fn(async () => { throw new ConversionLibraryError('PREVIEW_STALE', 'Refresh the preview.'); });
    const server = createGrocyMealieSyncMcpServer({ conversionLibrary: { importConversionLibrary: importService,
      previewConversionImport: async () => { throw new ConversionLibraryError('INVALID_SELECTION', 'Unknown entry.'); },
    } });
    const client = new Client({ name: 'conversion-error-test', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport); await client.connect(clientTransport);
    try {
      const unknown = await client.callTool({ name: 'conversions.library.preview', arguments: { entryIds: ['unknown-entry'] } });
      expect(unknown.isError).toBe(true);
      expect(unknown.structuredContent).toMatchObject({ ok: false, data: { code: 'INVALID_SELECTION' } });
      const invalid = await client.callTool({ name: 'conversions.library.import', arguments: { entryIds: ['kilogram-to-gram'] } });
      expect(invalid.isError).toBe(true); expect(importService).not.toHaveBeenCalled();
      const stale = await client.callTool({ name: 'conversions.library.import', arguments: { entryIds: ['kilogram-to-gram'], fingerprint: 'a'.repeat(64) } });
      expect(stale.isError).toBe(true);
      expect(stale.structuredContent).toMatchObject({ ok: false, data: { code: 'PREVIEW_STALE' } });
    } finally { await client.close(); await server.close(); }
  });
});

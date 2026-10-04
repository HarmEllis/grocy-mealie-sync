import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConversionLibrary } from '@/lib/conversions/catalog';
import { importSelectionSchema, libraryImportSchema, libraryQuerySchema } from '@/lib/conversions/contracts';
import type { ConversionLibraryMcpServices, ConversionMcpServices, McpActionResult } from '../contracts';
import { ConversionLibraryError } from '@/lib/use-cases/conversions/library';
import { createJsonResourceContents, createJsonTextContent, createOkResult } from '../helpers';

export function registerConversionLibrary(server: McpServer, services: ConversionLibraryMcpServices, conversions: Pick<ConversionMcpServices, 'listConversions'>) {
  server.registerTool('conversions.library.list', {
    title: 'Browse the Shared Conversion Library',
    description: 'Browse verified metric and US customary conversion presets with stable entry IDs and sources. Use preview to resolve your Mealie and Grocy units before importing.',
    inputSchema: libraryQuerySchema.shape,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async input => {
    const result = createOkResult('Loaded the conversion library.', getConversionLibrary(input));
    return { content: [createJsonTextContent(result)], structuredContent: result };
  });
  server.registerTool('conversions.library.preview', {
    title: 'Preview a Shared Conversion Import',
    description: 'Preview selected catalog entry IDs for Mealie and Grocy (target both), or Grocy only. Resolve ambiguous units with bindings keyed by canonical unit ID. createMissingUnits explicitly allows proposed unit creations. Preview performs zero writes and returns a required fingerprint.',
    inputSchema: importSelectionSchema.shape,
    annotations: { readOnlyHint: true },
  }, async input => {
    try {
      const data = await services.previewConversionImport(input);
      const result = createOkResult(data.canImport ? 'The import is ready for review.' : 'Resolve the unit choices and conflicts before importing.', data);
      return { content: [createJsonTextContent(result)], structuredContent: result };
    } catch (error) {
      if (!(error instanceof ConversionLibraryError)) throw error;
      const result = { ok: false, status: 'error', message: error.message, data: { code: error.code, preview: error.preview } };
      return { content: [createJsonTextContent(result)], structuredContent: result, isError: true };
    }
  });
  server.registerTool('conversions.library.import', {
    title: 'Import Shared Units and Conversions',
    description: 'Apply the exact reviewed selection and fingerprint from preview. Reuses units, fills missing Mealie standardization, links mappings and adds Grocy definitions. Existing factors are preserved. Results include each completed write and partial failures; re-preview before retrying.',
    inputSchema: libraryImportSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, async input => {
    try {
      const data = await services.importConversionLibrary(input);
      const result: McpActionResult<typeof data> = {
        ok: data.failed === 0,
        status: data.status === 'partial' ? 'partial' : data.status === 'failure' ? 'error' : data.status === 'skipped' ? 'skipped' : 'ok',
        message: `${data.created} change(s), ${data.failed} failure(s). Import status: ${data.status}.`,
        data,
      };
      return { content: [createJsonTextContent(result)], structuredContent: result, ...(data.failed ? { isError: true } : {}) };
    } catch (error) {
      if (!(error instanceof ConversionLibraryError)) throw error;
      const result = { ok: false, status: 'error', message: error.message, data: { code: error.code, preview: error.preview } };
      return { content: [createJsonTextContent(result)], structuredContent: result, isError: true };
    }
  });
  server.registerResource('conversion-library', 'gms://conversions/library', {
    title: 'Shared Conversion Library', description: 'Versioned metric and US customary presets with explicit measurement systems.', mimeType: 'application/json',
  }, async uri => createJsonResourceContents(uri.toString(), getConversionLibrary()));
  server.registerResource('installed-conversions', 'gms://conversions/installed', {
    title: 'Installed Grocy Conversions', description: 'Current global and product-specific unit conversion definitions.', mimeType: 'application/json',
  }, async uri => createJsonResourceContents(uri.toString(), await conversions.listConversions()));
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { HistoryRunResource, RecentHistoryResource } from '@/lib/use-cases/history/read';
import { createMcpHttpHandler } from '../http';

describe('MCP history access', () => {
  const listRecentHistoryResource = vi.fn(async (): Promise<RecentHistoryResource> => ({
    count: 1,
    runs: [
      {
        id: 'run-1',
        trigger: 'manual',
        action: 'mapping_product_create',
        status: 'success',
        message: 'Created one Grocy product mapping.',
        startedAt: new Date('2026-03-28T10:00:00.000Z'),
        finishedAt: new Date('2026-03-28T10:01:00.000Z'),
        summary: { created: 1 },
        eventCount: 2,
      },
    ],
  }));

  const getHistoryRunResource = vi.fn(async (): Promise<HistoryRunResource> => ({
    run: {
      id: 'run-1',
      trigger: 'manual',
      action: 'mapping_product_create',
      status: 'success',
      message: 'Created one Grocy product mapping.',
      startedAt: new Date('2026-03-28T10:00:00.000Z'),
      finishedAt: new Date('2026-03-28T10:01:00.000Z'),
      summary: { created: 1 },
      eventCount: 2,
    },
    events: [
      {
        id: 'event-1',
        runId: 'run-1',
        level: 'info',
        category: 'mapping',
        entityKind: 'product',
        entityRef: 'map-1',
        message: 'Created product mapping map-1.',
        details: { mappingId: 'map-1' },
        createdAt: new Date('2026-03-28T10:00:30.000Z'),
      },
    ],
  }));

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('serves recent history resources and run details', async () => {
    const handleRequest = createMcpHttpHandler({
      resources: {
        listRecentHistoryResource,
        getHistoryRunResource,
      },
      history: {
        listRecentHistoryResource,
        getHistoryRunResource,
      },
    });

    const client = new Client(
      { name: 'mcp-history-test-client', version: '1.0.0' },
      { capabilities: {} },
    );

    const transport = new StreamableHTTPClientTransport(
      new URL('http://localhost/api/mcp'),
      {
        fetch: async (input, init) => handleRequest(
          input instanceof Request ? input : new Request(input, init),
        ),
      },
    );

    try {
      await client.connect(transport);

      const [tools, resources, templates] = await Promise.all([
        client.listTools(),
        client.listResources(),
        client.listResourceTemplates(),
      ]);

      expect(tools.tools.map(tool => tool.name)).toEqual(expect.arrayContaining([
        'history.list_runs',
        'history.get_run',
      ]));
      expect(resources.resources.map(resource => resource.uri)).toEqual(expect.arrayContaining([
        'gms://history/recent',
      ]));
      expect(templates.resourceTemplates.map(template => template.uriTemplate)).toEqual(expect.arrayContaining([
        'gms://history/runs/{runId}',
      ]));

      const historyListResult = await client.callTool({
        name: 'history.list_runs',
        arguments: { limit: 10 },
      });
      const historyRunResult = await client.callTool({
        name: 'history.get_run',
        arguments: { runId: 'run-1' },
      });

      expect(historyListResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Found 1 history run.',
        data: {
          count: 1,
          runs: [
            {
              id: 'run-1',
              trigger: 'manual',
              action: 'mapping_product_create',
              status: 'success',
              message: 'Created one Grocy product mapping.',
              startedAt: '2026-03-28T10:00:00.000Z',
              finishedAt: '2026-03-28T10:01:00.000Z',
              summary: { created: 1 },
              eventCount: 2,
            },
          ],
        },
      });
      expect(historyRunResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Loaded history run details.',
        data: {
          run: {
            id: 'run-1',
            trigger: 'manual',
            action: 'mapping_product_create',
            status: 'success',
            message: 'Created one Grocy product mapping.',
            startedAt: '2026-03-28T10:00:00.000Z',
            finishedAt: '2026-03-28T10:01:00.000Z',
            summary: { created: 1 },
            eventCount: 2,
          },
          events: [
            {
              id: 'event-1',
              runId: 'run-1',
              level: 'info',
              category: 'mapping',
              entityKind: 'product',
              entityRef: 'map-1',
              message: 'Created product mapping map-1.',
              details: { mappingId: 'map-1' },
              createdAt: '2026-03-28T10:00:30.000Z',
            },
          ],
        },
      });

      const historyResource = await client.readResource({ uri: 'gms://history/recent' });
      const historyContent = historyResource.contents[0];
      expect(historyContent && 'text' in historyContent ? JSON.parse(historyContent.text) : null).toEqual({
        count: 1,
        runs: [
          {
            id: 'run-1',
            trigger: 'manual',
            action: 'mapping_product_create',
            status: 'success',
            message: 'Created one Grocy product mapping.',
            startedAt: '2026-03-28T10:00:00.000Z',
            finishedAt: '2026-03-28T10:01:00.000Z',
            summary: { created: 1 },
            eventCount: 2,
          },
        ],
      });

      const historyRunResource = await client.readResource({ uri: 'gms://history/runs/run-1' });
      const historyRunContent = historyRunResource.contents[0];
      expect(historyRunContent && 'text' in historyRunContent ? JSON.parse(historyRunContent.text) : null).toEqual({
        run: {
          id: 'run-1',
          trigger: 'manual',
          action: 'mapping_product_create',
          status: 'success',
          message: 'Created one Grocy product mapping.',
          startedAt: '2026-03-28T10:00:00.000Z',
          finishedAt: '2026-03-28T10:01:00.000Z',
          summary: { created: 1 },
          eventCount: 2,
        },
        events: [
          {
            id: 'event-1',
            runId: 'run-1',
            level: 'info',
            category: 'mapping',
            entityKind: 'product',
            entityRef: 'map-1',
            message: 'Created product mapping map-1.',
            details: { mappingId: 'map-1' },
            createdAt: '2026-03-28T10:00:30.000Z',
          },
        ],
      });
    } finally {
      await Promise.allSettled([client.close(), transport.close()]);
    }
  });
});

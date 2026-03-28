import { describe, expect, it, vi } from 'vitest';
import { getHistoryRunResource, listRecentHistoryResource } from '../read';

describe('history read use-cases', () => {
  it('returns recent history runs with a count', async () => {
    const result = await listRecentHistoryResource(
      { limit: 10 },
      {
        listHistoryRuns: vi.fn(async () => [
          {
            id: 'run-1',
            trigger: 'manual' as const,
            action: 'mapping_product_create' as const,
            status: 'success' as const,
            message: 'Created 1 Grocy product mapping.',
            startedAt: new Date('2026-03-28T10:00:00.000Z'),
            finishedAt: new Date('2026-03-28T10:01:00.000Z'),
            summary: { created: 1 },
            eventCount: 2,
          },
        ]),
      },
    );

    expect(result).toEqual({
      count: 1,
      runs: [
        {
          id: 'run-1',
          trigger: 'manual',
          action: 'mapping_product_create',
          status: 'success',
          message: 'Created 1 Grocy product mapping.',
          startedAt: new Date('2026-03-28T10:00:00.000Z'),
          finishedAt: new Date('2026-03-28T10:01:00.000Z'),
          summary: { created: 1 },
          eventCount: 2,
        },
      ],
    });
  });

  it('returns one history run with events', async () => {
    const result = await getHistoryRunResource(
      { runId: 'run-1' },
      {
        getHistoryRunDetails: vi.fn(async () => ({
          run: {
            id: 'run-1',
            trigger: 'manual' as const,
            action: 'mapping_product_create' as const,
            status: 'success' as const,
            message: 'Created 1 Grocy product mapping.',
            startedAt: new Date('2026-03-28T10:00:00.000Z'),
            finishedAt: new Date('2026-03-28T10:01:00.000Z'),
            summary: { created: 1 },
            eventCount: 2,
          },
          events: [
            {
              id: 'event-1',
              runId: 'run-1',
              level: 'info' as const,
              category: 'mapping' as const,
              entityKind: 'product' as const,
              entityRef: 'map-1',
              message: 'Created product mapping map-1.',
              details: { mappingId: 'map-1' },
              createdAt: new Date('2026-03-28T10:00:30.000Z'),
            },
          ],
        })),
      },
    );

    expect(result).toEqual({
      run: {
        id: 'run-1',
        trigger: 'manual',
        action: 'mapping_product_create',
        status: 'success',
        message: 'Created 1 Grocy product mapping.',
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
    });
  });
});

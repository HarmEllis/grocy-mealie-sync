import { describe, expect, it } from 'vitest';
import { applyBulkSuggestions, isSuggestionTargetAvailable } from '../suggestion-actions';

describe('suggestion-actions', () => {
  it('applies bulk suggestions above the threshold without reusing targets', () => {
    const result = applyBulkSuggestions({
      threshold: 90,
      currentTargetIdsBySourceId: {
        foodA: null,
        foodB: null,
        foodC: null,
      },
      suggestionsBySourceId: {
        foodA: { targetId: 101, score: 96, ambiguous: false },
        foodB: { targetId: 101, score: 93, ambiguous: true },
        foodC: { targetId: 102, score: 88, ambiguous: false },
      },
    });

    expect(result.appliedSourceIds).toEqual(['foodA']);
    expect(result.ambiguousSourceIds).toEqual([]);
  });

  it('marks ambiguous rows when they are bulk-filled', () => {
    const result = applyBulkSuggestions({
      threshold: 90,
      currentTargetIdsBySourceId: {
        unitA: null,
      },
      suggestionsBySourceId: {
        unitA: { targetId: 10, score: 91, ambiguous: true },
      },
    });

    expect(result.appliedSourceIds).toEqual(['unitA']);
    expect(result.ambiguousSourceIds).toEqual(['unitA']);
  });

  it('keeps one-to-one matching when a target is already selected elsewhere', () => {
    expect(isSuggestionTargetAvailable({
      sourceId: 'foodB',
      targetId: 101,
      currentTargetIdsBySourceId: {
        foodA: 101,
        foodB: null,
      },
    })).toBe(false);
  });
});

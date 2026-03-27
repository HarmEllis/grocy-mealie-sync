export interface BulkSuggestion<TTargetId extends string | number> {
  targetId: TTargetId;
  score: number;
  ambiguous: boolean;
}

interface IsSuggestionTargetAvailableInput<TSourceId extends string | number, TTargetId extends string | number> {
  sourceId: TSourceId;
  targetId: TTargetId;
  currentTargetIdsBySourceId: Record<string, TTargetId | null | undefined>;
}

interface ApplyBulkSuggestionsInput<TTargetId extends string | number> {
  threshold: number;
  currentTargetIdsBySourceId: Record<string, TTargetId | null | undefined>;
  suggestionsBySourceId: Record<string, BulkSuggestion<TTargetId> | undefined>;
}

export function isSuggestionTargetAvailable<TSourceId extends string | number, TTargetId extends string | number>({
  sourceId,
  targetId,
  currentTargetIdsBySourceId,
}: IsSuggestionTargetAvailableInput<TSourceId, TTargetId>): boolean {
  return !Object.entries(currentTargetIdsBySourceId).some(([otherSourceId, otherTargetId]) =>
    otherSourceId !== String(sourceId) && otherTargetId === targetId,
  );
}

export function applyBulkSuggestions<TTargetId extends string | number>({
  threshold,
  currentTargetIdsBySourceId,
  suggestionsBySourceId,
}: ApplyBulkSuggestionsInput<TTargetId>): {
  appliedSourceIds: string[];
  ambiguousSourceIds: string[];
} {
  const pendingSuggestions = Object.entries(suggestionsBySourceId)
    .filter((entry): entry is [string, BulkSuggestion<TTargetId>] => !!entry[1])
    .filter(([, suggestion]) => suggestion.score >= threshold)
    .sort((left, right) => {
      const scoreDiff = right[1].score - left[1].score;
      return scoreDiff !== 0 ? scoreDiff : left[0].localeCompare(right[0]);
    });

  const nextTargetIdsBySourceId = { ...currentTargetIdsBySourceId };
  const appliedSourceIds: string[] = [];
  const ambiguousSourceIds: string[] = [];

  for (const [sourceId, suggestion] of pendingSuggestions) {
    if (nextTargetIdsBySourceId[sourceId] != null) {
      continue;
    }

    if (!isSuggestionTargetAvailable({
      sourceId,
      targetId: suggestion.targetId,
      currentTargetIdsBySourceId: nextTargetIdsBySourceId,
    })) {
      continue;
    }

    nextTargetIdsBySourceId[sourceId] = suggestion.targetId;
    appliedSourceIds.push(sourceId);

    if (suggestion.ambiguous) {
      ambiguousSourceIds.push(sourceId);
    }
  }

  return {
    appliedSourceIds,
    ambiguousSourceIds,
  };
}

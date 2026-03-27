/**
 * Fuzzy matching utility for product and unit name matching.
 * Uses a combination of token overlap, substring matching, and character similarity.
 */

export interface MatchVariant {
  text: string;
  kind?: string;
  weight?: number;
}

export interface FuzzyMatch<T> {
  item: T;
  score: number;
}

export interface RankedVariantMatch<T> extends FuzzyMatch<T> {
  text: string;
  kind: string;
}

export interface SuggestedMatch<T> {
  best: RankedVariantMatch<T> | null;
  runnerUp: RankedVariantMatch<T> | null;
  ambiguous: boolean;
}

const DEFAULT_VARIANT_KIND = 'name';
const DEFAULT_VARIANT_WEIGHT = 1;
const DEFAULT_AMBIGUOUS_GAP = 0.05;

function singularizeToken(token: string): string {
  if (token.length <= 3) {
    return token;
  }

  if (token.endsWith('ies') && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith('es') && token.length > 4 && !token.endsWith('ses')) {
    return token.slice(0, -2);
  }

  if (token.endsWith('s') && !token.endsWith('ss')) {
    return token.slice(0, -1);
  }

  return token;
}

export function normalizeMatchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenize(value: string): string[] {
  return normalizeMatchText(value)
    .split(/\s+/)
    .filter(Boolean)
    .map(singularizeToken);
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

function normalizeVariant(variant: MatchVariant): MatchVariant {
  return {
    text: variant.text,
    kind: variant.kind ?? DEFAULT_VARIANT_KIND,
    weight: variant.weight ?? DEFAULT_VARIANT_WEIGHT,
  };
}

function dedupeVariants(variants: MatchVariant[]): MatchVariant[] {
  const deduped = new Map<string, MatchVariant>();

  for (const rawVariant of variants) {
    if (!rawVariant.text?.trim()) {
      continue;
    }

    const variant = normalizeVariant(rawVariant);
    const key = `${variant.kind}:${normalizeMatchText(variant.text)}`;
    const existing = deduped.get(key);

    if (!existing || (variant.weight ?? DEFAULT_VARIANT_WEIGHT) > (existing.weight ?? DEFAULT_VARIANT_WEIGHT)) {
      deduped.set(key, variant);
    }
  }

  return [...deduped.values()];
}

/** Compute token overlap score (Jaccard-like with partial matching). */
function tokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;

  let matches = 0;
  for (const tokenA of a) {
    for (const tokenB of b) {
      if (tokenA === tokenB) {
        matches++;
        break;
      }

      if (tokenA.startsWith(tokenB) || tokenB.startsWith(tokenA)) {
        matches += 0.8;
        break;
      }
    }
  }

  return matches / Math.max(a.length, b.length);
}

/** Check if one normalized string contains the other. */
function substringScore(a: string, b: string): number {
  const normalizedA = normalizeMatchText(a);
  const normalizedB = normalizeMatchText(b);

  if (!normalizedA || !normalizedB) {
    return 0;
  }

  if (normalizedA === normalizedB) return 1;
  if (normalizedA.includes(normalizedB)) return 0.7 + 0.2 * (normalizedB.length / normalizedA.length);
  if (normalizedB.includes(normalizedA)) return 0.7 + 0.2 * (normalizedA.length / normalizedB.length);
  return 0;
}

/** Simple character-level similarity (optimized Levenshtein ratio). */
function charSimilarity(a: string, b: string): number {
  const normalizedA = normalizeMatchText(a);
  const normalizedB = normalizeMatchText(b);
  if (normalizedA === normalizedB) return 1;
  if (normalizedA.length === 0 || normalizedB.length === 0) return 0;

  const maxLen = Math.max(normalizedA.length, normalizedB.length);
  if (maxLen > 60) {
    return 0;
  }

  const prev = Array.from({ length: normalizedB.length + 1 }, (_, i) => i);
  for (let i = 1; i <= normalizedA.length; i++) {
    let prevDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= normalizedB.length; j++) {
      const tmp = prev[j];
      prev[j] = normalizedA[i - 1] === normalizedB[j - 1]
        ? prevDiag
        : 1 + Math.min(prev[j], prev[j - 1], prevDiag);
      prevDiag = tmp;
    }
  }

  return 1 - prev[normalizedB.length] / maxLen;
}

/**
 * Score how well `query` matches `target`.
 * Returns a score from 0 (no match) to 1 (exact match).
 */
export function fuzzyScore(query: string, target: string): number {
  if (!query || !target) return 0;

  const substring = substringScore(query, target);
  const queryTokens = tokenize(query);
  const targetTokens = tokenize(target);
  const tokenScore = tokenOverlap(queryTokens, targetTokens);
  const charScore = charSimilarity(query, target);

  return Math.max(substring, tokenScore * 0.95, charScore * 0.7);
}

/**
 * Find the best fuzzy matches for a query against a list of candidates.
 * Returns matches sorted by score (highest first), filtered by minimum threshold.
 */
export function fuzzyMatch<T>(
  query: string,
  candidates: T[],
  getText: (item: T) => string,
  threshold = 0.3,
  maxResults = 5,
): FuzzyMatch<T>[] {
  const results: FuzzyMatch<T>[] = [];

  for (const item of candidates) {
    const score = fuzzyScore(query, getText(item));
    if (score >= threshold) {
      results.push({ item, score });
    }
  }

  results.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return compareStrings(getText(left.item), getText(right.item));
  });
  return results.slice(0, maxResults);
}

export function rankVariantMatches<T>(
  queryVariants: MatchVariant[],
  candidates: T[],
  getVariants: (item: T) => MatchVariant[],
  threshold = 0.3,
  maxResults = 5,
): RankedVariantMatch<T>[] {
  const normalizedQueryVariants = dedupeVariants(queryVariants);
  const results: RankedVariantMatch<T>[] = [];

  for (const item of candidates) {
    const candidateVariants = dedupeVariants(getVariants(item));
    let bestMatch: RankedVariantMatch<T> | null = null;

    for (const queryVariant of normalizedQueryVariants) {
      for (const candidateVariant of candidateVariants) {
        const weightedScore = Math.min(
          1,
          fuzzyScore(queryVariant.text, candidateVariant.text)
            * (queryVariant.weight ?? DEFAULT_VARIANT_WEIGHT)
            * (candidateVariant.weight ?? DEFAULT_VARIANT_WEIGHT),
        );

        if (!bestMatch || weightedScore > bestMatch.score) {
          bestMatch = {
            item,
            score: weightedScore,
            text: candidateVariant.text,
            kind: candidateVariant.kind ?? DEFAULT_VARIANT_KIND,
          };
          continue;
        }

        if (weightedScore === bestMatch.score) {
          const bestText = normalizeMatchText(bestMatch.text);
          const candidateText = normalizeMatchText(candidateVariant.text);

          if (compareStrings(candidateText, bestText) < 0) {
            bestMatch = {
              item,
              score: weightedScore,
              text: candidateVariant.text,
              kind: candidateVariant.kind ?? DEFAULT_VARIANT_KIND,
            };
          }
        }
      }
    }

    if (bestMatch && bestMatch.score >= threshold) {
      results.push(bestMatch);
    }
  }

  results.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return compareStrings(normalizeMatchText(left.text), normalizeMatchText(right.text));
  });

  return results.slice(0, maxResults);
}

export function findSuggestedMatch<T>(
  queryVariants: MatchVariant[],
  candidates: T[],
  getVariants: (item: T) => MatchVariant[],
  {
    threshold = 0.3,
    ambiguityGap = DEFAULT_AMBIGUOUS_GAP,
  }: {
    threshold?: number;
    ambiguityGap?: number;
  } = {},
): SuggestedMatch<T> {
  const matches = rankVariantMatches(queryVariants, candidates, getVariants, threshold, 2);
  const best = matches[0] ?? null;
  const rawRunnerUp = matches[1] ?? null;
  const ambiguous = !!best && !!rawRunnerUp && best.score - rawRunnerUp.score <= ambiguityGap;

  return {
    best,
    runnerUp: ambiguous ? rawRunnerUp : null,
    ambiguous,
  };
}

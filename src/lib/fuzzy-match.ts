/**
 * Fuzzy matching utility for product and unit name matching.
 * Uses a combination of token overlap, substring matching, and character similarity.
 */

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

function tokenize(s: string): string[] {
  return normalize(s).split(/\s+/).filter(Boolean);
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
      // Partial: one token starts with the other
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
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1.0;
  if (na.includes(nb)) return 0.7 + 0.2 * (nb.length / na.length);
  if (nb.includes(na)) return 0.7 + 0.2 * (na.length / nb.length);
  return 0;
}

/** Simple character-level similarity (optimized Levenshtein ratio). */
function charSimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1.0;
  if (na.length === 0 || nb.length === 0) return 0;

  const maxLen = Math.max(na.length, nb.length);
  if (maxLen > 60) {
    // Skip expensive edit distance for very long strings, rely on token matching
    return 0;
  }

  // Levenshtein distance
  const prev = Array.from({ length: nb.length + 1 }, (_, i) => i);
  for (let i = 1; i <= na.length; i++) {
    let prevDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= nb.length; j++) {
      const tmp = prev[j];
      prev[j] = na[i - 1] === nb[j - 1]
        ? prevDiag
        : 1 + Math.min(prev[j], prev[j - 1], prevDiag);
      prevDiag = tmp;
    }
  }

  return 1 - prev[nb.length] / maxLen;
}

export interface FuzzyMatch<T> {
  item: T;
  score: number;
}

/**
 * Score how well `query` matches `target`.
 * Returns a score from 0 (no match) to 1 (exact match).
 */
export function fuzzyScore(query: string, target: string): number {
  if (!query || !target) return 0;

  const sub = substringScore(query, target);
  const tokensA = tokenize(query);
  const tokensB = tokenize(target);
  const tok = tokenOverlap(tokensA, tokensB);
  const chr = charSimilarity(query, target);

  // Weighted combination: token overlap and substring matching are most reliable
  return Math.max(sub, tok * 0.9, chr * 0.7);
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

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}

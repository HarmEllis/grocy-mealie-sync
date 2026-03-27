import { describe, it, expect } from 'vitest';
import { findSuggestedMatch, fuzzyScore, fuzzyMatch, normalizeMatchText } from '../fuzzy-match';

describe('normalizeMatchText', () => {
  it('normalizes accents, ampersands, punctuation, and whitespace', () => {
    expect(normalizeMatchText("  Crème fraîche & milk!  ")).toBe('creme fraiche and milk');
  });
});

describe('fuzzyScore', () => {
  it('returns 1.0 for exact matches', () => {
    expect(fuzzyScore('Milk', 'Milk')).toBe(1.0);
  });

  it('returns 1.0 for case-insensitive exact matches', () => {
    expect(fuzzyScore('milk', 'MILK')).toBe(1.0);
  });

  it('returns 0 for empty strings', () => {
    expect(fuzzyScore('', 'test')).toBe(0);
    expect(fuzzyScore('test', '')).toBe(0);
    expect(fuzzyScore('', '')).toBe(0);
  });

  it('scores high for substring matches', () => {
    const score = fuzzyScore('Whole Milk', 'Milk');
    expect(score).toBeGreaterThan(0.7);
  });

  it('scores high for token overlap', () => {
    const score = fuzzyScore('Brown Rice', 'Rice Brown');
    expect(score).toBeGreaterThan(0.8);
  });

  it('scores low for unrelated strings', () => {
    const score = fuzzyScore('Apples', 'Bread');
    expect(score).toBeLessThan(0.3);
  });

  it('handles special characters in names', () => {
    const score = fuzzyScore("Ben & Jerry's", 'Ben and Jerrys');
    expect(score).toBeGreaterThan(0.5);
  });

  it('handles partial token matches', () => {
    const score = fuzzyScore('Chick', 'Chicken Breast');
    expect(score).toBeGreaterThan(0.5);
  });

  it('scores plural and singular forms as a strong match', () => {
    const score = fuzzyScore('Tablespoons', 'Tablespoon');
    expect(score).toBeGreaterThan(0.9);
  });

  it('skips character similarity for very long strings (>60 chars)', () => {
    const long = 'a'.repeat(61);
    const score = fuzzyScore(long, long.slice(0, 30));
    // Should still get a score from token/substring matching
    expect(score).toBeGreaterThan(0);
  });
});

describe('fuzzyMatch', () => {
  const candidates = ['Whole Milk', 'Skim Milk', 'Almond Milk', 'Orange Juice', 'Bread'];

  it('returns best matches sorted by score', () => {
    const results = fuzzyMatch('Milk', candidates, (x) => x);
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results[0].item).toContain('Milk');
    // Scores should be descending
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('respects maxResults parameter', () => {
    const results = fuzzyMatch('Milk', candidates, (x) => x, 0.3, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('respects threshold parameter', () => {
    const results = fuzzyMatch('Milk', candidates, (x) => x, 0.99);
    // Only exact/near-exact matches should pass a 0.99 threshold
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0.99);
    }
  });

  it('returns empty array when nothing matches', () => {
    const results = fuzzyMatch('xyz123', candidates, (x) => x, 0.5);
    expect(results).toEqual([]);
  });

  it('works with object candidates and getText', () => {
    const items = [
      { id: 1, name: 'Pasta' },
      { id: 2, name: 'Pasta Sauce' },
      { id: 3, name: 'Rice' },
    ];
    const results = fuzzyMatch('Pasta', items, (x) => x.name);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].item.name).toContain('Pasta');
  });
});

describe('findSuggestedMatch', () => {
  it('matches against weighted variants such as abbreviations and aliases', () => {
    const candidates = [
      {
        id: 1,
        name: 'Tablespoon',
        variants: [
          { text: 'Tablespoon', kind: 'name' },
          { text: 'Tablespoons', kind: 'plural' },
          { text: 'tbsp', kind: 'abbreviation' },
          { text: 'eetlepel', kind: 'alias' },
        ],
      },
      {
        id: 2,
        name: 'Teaspoon',
        variants: [
          { text: 'Teaspoon', kind: 'name' },
          { text: 'Teaspoons', kind: 'plural' },
          { text: 'tsp', kind: 'abbreviation' },
        ],
      },
    ];

    const result = findSuggestedMatch(
      [
        { text: 'Eetlepel', kind: 'alias', weight: 0.95 },
        { text: 'tbsp', kind: 'abbreviation', weight: 0.92 },
      ],
      candidates,
      candidate => candidate.variants,
    );

    expect(result.best?.item.id).toBe(1);
    expect(result.best?.score).toBeGreaterThan(0.9);
    expect(result.best?.kind).toBe('alias');
    expect(result.runnerUp).toBeNull();
    expect(result.ambiguous).toBe(false);
  });

  it('returns a runner-up and marks close scores as ambiguous', () => {
    const candidates = [
      {
        name: 'Brown Rice',
        variants: [{ text: 'Brown Rice', kind: 'name' }],
      },
      {
        name: 'White Rice',
        variants: [{ text: 'White Rice', kind: 'name' }],
      },
    ];

    const result = findSuggestedMatch(
      [{ text: 'Rice', kind: 'name' }],
      candidates,
      candidate => candidate.variants,
    );

    expect(result.best?.item.name).toBe('Brown Rice');
    expect(result.runnerUp?.item.name).toBe('White Rice');
    expect(result.ambiguous).toBe(true);
  });
});

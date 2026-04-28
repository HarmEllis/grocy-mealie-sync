import { describe, it, expect } from 'vitest';
import {
  parseSubProductNoteAmounts,
  buildSubProductNote,
  isValidSubProductItem,
  splitShoppingNoteSegments,
  mergeShoppingNotes,
  replaceSubProductNote,
  type SubProductItem,
} from '../shopping-notes';

describe('parseSubProductNoteAmounts', () => {
  it('returns null for a null note', () => {
    expect(parseSubProductNoteAmounts(null)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseSubProductNoteAmounts('')).toBeNull();
  });

  it('returns null when no segment matches the amount pattern', () => {
    expect(parseSubProductNoteAmounts('some free text')).toBeNull();
  });

  it('parses a single "N× Name" segment', () => {
    const result = parseSubProductNoteAmounts('2× Volle Melk');
    expect(result).not.toBeNull();
    expect(result!.get('Volle Melk')).toBe(2);
  });

  it('parses multiple segments separated by |', () => {
    const result = parseSubProductNoteAmounts('2× Volle Melk | 1× Halfvolle Melk');
    expect(result).not.toBeNull();
    expect(result!.get('Volle Melk')).toBe(2);
    expect(result!.get('Halfvolle Melk')).toBe(1);
  });

  it('accepts lowercase x as separator', () => {
    const result = parseSubProductNoteAmounts('3x Butter');
    expect(result).not.toBeNull();
    expect(result!.get('Butter')).toBe(3);
  });

  it('returns partial matches when mixed with non-matching segments', () => {
    const result = parseSubProductNoteAmounts('user note | 2× Milk');
    expect(result).not.toBeNull();
    expect(result!.get('Milk')).toBe(2);
    expect(result!.size).toBe(1);
  });
});

describe('buildSubProductNote', () => {
  it('formats items as "N× Name" joined by " | "', () => {
    const items: SubProductItem[] = [
      { name: 'Volle Melk', grocyProductId: 1, amount: 2 },
      { name: 'Halfvolle Melk', grocyProductId: 2, amount: 1 },
    ];
    expect(buildSubProductNote(items)).toBe('2× Volle Melk | 1× Halfvolle Melk');
  });

  it('formats a single item correctly', () => {
    const items: SubProductItem[] = [
      { name: 'Butter', grocyProductId: 5, amount: 3 },
    ];
    expect(buildSubProductNote(items)).toBe('3× Butter');
  });
});

describe('isValidSubProductItem', () => {
  it('accepts a valid item', () => {
    expect(isValidSubProductItem({ name: 'Milk', grocyProductId: 1, amount: 2 })).toBe(true);
  });

  it('rejects null', () => {
    expect(isValidSubProductItem(null)).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(isValidSubProductItem({ name: 'Milk', grocyProductId: 1 })).toBe(false);
  });

  it('rejects wrong types', () => {
    expect(isValidSubProductItem({ name: 1, grocyProductId: 1, amount: 2 })).toBe(false);
  });
});

describe('splitShoppingNoteSegments', () => {
  it('splits by | and trims segments', () => {
    expect(splitShoppingNoteSegments('a | b | c')).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array for null', () => {
    expect(splitShoppingNoteSegments(null)).toEqual([]);
  });

  it('filters out empty segments', () => {
    expect(splitShoppingNoteSegments('a |  | b')).toEqual(['a', 'b']);
  });
});

describe('mergeShoppingNotes', () => {
  it('merges two distinct notes', () => {
    expect(mergeShoppingNotes('a', 'b')).toBe('a | b');
  });

  it('deduplicates identical segments (case-insensitive)', () => {
    expect(mergeShoppingNotes('Milk', 'milk')).toBe('Milk');
  });

  it('returns null when all inputs are empty', () => {
    expect(mergeShoppingNotes(null, '')).toBeNull();
  });
});

describe('replaceSubProductNote', () => {
  it('appends a new segment when there is no existing note', () => {
    expect(replaceSubProductNote(null, null, '2× Milk')).toBe('2× Milk');
  });

  it('replaces a previously written segment at the end', () => {
    expect(replaceSubProductNote('user note 2× Milk', '2× Milk', '3× Milk')).toBe('user note 3× Milk');
  });

  it('removes the managed segment when newSegment is null', () => {
    expect(replaceSubProductNote('user note 2× Milk', '2× Milk', null)).toBe('user note');
  });

  it('does not remove segment that appears earlier but not at the end', () => {
    const result = replaceSubProductNote('2× Milk | user note', '2× Milk', '3× Milk');
    expect(result).toBe('2× Milk | user note 3× Milk');
  });
});

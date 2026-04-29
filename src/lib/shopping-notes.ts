import { normalizeMatchText } from '@/lib/fuzzy-match';

export const GMS_NAMES_KEY = 'grocy_sync_subproducts';
export const GMS_NOTE_KEY = 'grocy_sync_subproducts_note';
export const GMS_ITEMS_KEY = 'grocy_sync_subproduct_items';

export interface SubProductItem {
  name: string;
  grocyProductId: number;
  amount: number;
}

export function isValidSubProductItem(value: unknown): value is SubProductItem {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === 'string' && typeof v.grocyProductId === 'number' && typeof v.amount === 'number';
}

export function splitShoppingNoteSegments(note: string | null | undefined): string[] {
  return (note ?? '')
    .split('|')
    .map(segment => segment.trim())
    .filter(Boolean);
}

export function mergeShoppingNotes(...notes: Array<string | null | undefined>): string | null {
  const segments: string[] = [];
  const seen = new Set<string>();

  for (const note of notes) {
    for (const segment of splitShoppingNoteSegments(note)) {
      const normalizedSegment = normalizeMatchText(segment);
      if (!normalizedSegment || seen.has(normalizedSegment)) {
        continue;
      }

      seen.add(normalizedSegment);
      segments.push(segment);
    }
  }

  return segments.length > 0 ? segments.join(' | ') : null;
}

export function buildSubProductNote(items: SubProductItem[]): string {
  return items.map(i => `${i.amount}× ${i.name}`).join(' | ');
}

/**
 * Parse a note that may contain sub-product segments in the form "2× Name" or "2x Name".
 * Returns a Map of name → amount for all matched segments, or null if no segment matched.
 * Partial matches are returned (matched entries apply, unmatched entries fall back to extras).
 */
export function parseSubProductNoteAmounts(
  note: string | null | undefined,
): Map<string, number> | null {
  const segments = splitShoppingNoteSegments(note);
  const result = new Map<string, number>();
  for (const segment of segments) {
    const match = /^(\d+)[×x]\s*(.+)$/iu.exec(segment);
    if (match) {
      result.set(match[2].trim(), Number(match[1]));
    }
  }
  return result.size > 0 ? result : null;
}

/**
 * Replace the previously written sub-product note segment with a new one,
 * leaving any other note content untouched.
 *
 * @param existingNote - Current note value on the Mealie shopping list item
 * @param prevWrittenSegment - Exact string that was previously written by sync (from extras[GMS_NOTE_KEY])
 * @param newSegment - New segment to insert, or null to clear
 */
export function replaceSubProductNote(
  existingNote: string | null | undefined,
  prevWrittenSegment: string | null,
  newSegment: string | null,
): string | null {
  let base = existingNote ?? '';
  if (prevWrittenSegment) {
    // The managed segment is always appended at the end, so use endsWith to avoid
    // accidentally removing matching user-authored text earlier in the note.
    if (base === prevWrittenSegment) {
      base = '';
    } else if (base.endsWith(` | ${prevWrittenSegment}`)) {
      base = base.slice(0, -(prevWrittenSegment.length + 3)).trim();
    } else if (base.endsWith(` ${prevWrittenSegment}`)) {
      // legacy: strip space-joined segment written before the pipe delimiter was introduced
      base = base.slice(0, -(prevWrittenSegment.length + 1)).trim();
    }
  }
  const result = [base, newSegment].filter(Boolean).join(' | ');
  return result || null;
}

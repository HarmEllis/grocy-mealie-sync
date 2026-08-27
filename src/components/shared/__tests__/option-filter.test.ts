import { describe, expect, it } from 'vitest';
import { filterOptions } from '../option-filter';

const options = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ value: index, label: `Product ${index}` }));

describe('filterOptions', () => {
  it('returns the first `limit` options for an empty query', () => {
    const result = filterOptions({ options: options(5000), query: '', limit: 200 });

    expect(result).toHaveLength(200);
    expect(result[0]).toEqual({ value: 0, label: 'Product 0' });
  });

  it('stops scanning once the limit is reached', () => {
    let reads = 0;
    const lazy = {
      *[Symbol.iterator]() {
        for (let index = 0; index < 5000; index += 1) {
          reads += 1;
          yield { value: index, label: `Product ${index}` };
        }
      },
    } as unknown as ReadonlyArray<{ value: number; label: string }>;

    filterOptions({ options: lazy, query: '', limit: 10 });

    expect(reads).toBe(10);
  });

  it('matches labels case-insensitively and ignores surrounding whitespace', () => {
    const result = filterOptions({
      options: [
        { value: 1, label: 'Whole Milk' },
        { value: 2, label: 'Oat drink' },
      ],
      query: '  MILK ',
      limit: 200,
    });

    expect(result).toEqual([{ value: 1, label: 'Whole Milk' }]);
  });

  it('hides values claimed by another row', () => {
    const result = filterOptions({
      options: options(5),
      query: '',
      limit: 200,
      isValueExcluded: (value) => [1, 3].includes(value),
    });

    expect(result.map(option => option.value)).toEqual([0, 2, 4]);
  });

  it('lists the pinned option first and never excludes it', () => {
    const result = filterOptions({
      options: options(3),
      query: '',
      limit: 200,
      isValueExcluded: (value) => [0, 1, 2].includes(value),
      pinned: { value: 1, label: 'Product 1' },
    });

    expect(result).toEqual([{ value: 1, label: 'Product 1' }]);
  });

  it('does not list the pinned option twice when it is still available', () => {
    const result = filterOptions({
      options: options(3),
      query: '',
      limit: 200,
      pinned: { value: 2, label: 'Product 2' },
    });

    expect(result.map(option => option.value)).toEqual([2, 0, 1]);
  });

  it('drops the pinned option when it does not match the query', () => {
    const result = filterOptions({
      options: [{ value: 1, label: 'Whole Milk' }],
      query: 'milk',
      limit: 200,
      pinned: { value: 2, label: 'Oat drink' },
    });

    expect(result).toEqual([{ value: 1, label: 'Whole Milk' }]);
  });

  it('counts the pinned option against the limit', () => {
    const result = filterOptions({
      options: options(10),
      query: '',
      limit: 3,
      pinned: { value: 9, label: 'Product 9' },
    });

    expect(result.map(option => option.value)).toEqual([9, 0, 1]);
  });
});

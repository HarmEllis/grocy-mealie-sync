export interface LibraryUnit {
  id: string;
  name: string;
  pluralName: string;
  abbreviation: string;
  dimension: 'mass' | 'volume';
  system: 'metric' | 'us';
  scale: number;
  standardUnit: 'gram' | 'milliliter';
  aliases: string[];
  ambiguous?: boolean;
}

export interface LibraryEntry {
  id: string;
  from: LibraryUnit;
  to: LibraryUnit;
  factor: number;
  equation: string;
}

export const CATALOG_VERSION = '1';
export const CATALOG_SOURCE = 'https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors';

function unit(id: string, name: string, abbreviation: string, dimension: LibraryUnit['dimension'], system: LibraryUnit['system'], scale: number, aliases: string[], ambiguous = false): LibraryUnit {
  return { id, name, pluralName: `${name}s`, abbreviation, dimension, system, scale,
    standardUnit: dimension === 'mass' ? 'gram' : 'milliliter', aliases, ambiguous };
}

// US customary liquid measures and avoirdupois mass; scales retain API precision.
export const LIBRARY_UNITS: LibraryUnit[] = [
  unit('gram', 'Gram', 'g', 'mass', 'metric', 1, ['gram', 'grams', 'grammen', 'g']),
  unit('milligram', 'Milligram', 'mg', 'mass', 'metric', 0.001, ['milligram', 'milligrams', 'mg']),
  unit('kilogram', 'Kilogram', 'kg', 'mass', 'metric', 1000, ['kilogram', 'kilograms', 'kilo', 'kg']),
  unit('milliliter', 'Milliliter', 'mL', 'volume', 'metric', 1, ['milliliter', 'millilitre', 'milliliters', 'ml']),
  unit('centiliter', 'Centiliter', 'cL', 'volume', 'metric', 10, ['centiliter', 'centilitre', 'cl']),
  unit('deciliter', 'Deciliter', 'dL', 'volume', 'metric', 100, ['deciliter', 'decilitre', 'dl']),
  unit('liter', 'Liter', 'L', 'volume', 'metric', 1000, ['liter', 'litre', 'liters', 'litres', 'l']),
  unit('us-ounce', 'US ounce', 'oz', 'mass', 'us', 28.349523125, ['ounce', 'ounces', 'oz'], true),
  unit('us-pound', 'Pound', 'lb', 'mass', 'us', 453.59237, ['pound', 'pounds', 'lb', 'lbs']),
  unit('us-fluid-ounce', 'US fluid ounce', 'US fl oz', 'volume', 'us', 29.5735295625, ['fluid ounce', 'ounce liquid', 'fl oz'], true),
  unit('us-cup', 'US cup', 'US cup', 'volume', 'us', 236.5882365, ['cup', 'cups'], true),
  unit('us-pint', 'US pint', 'US pt', 'volume', 'us', 473.176473, ['pint', 'pints', 'pt'], true),
  unit('us-quart', 'US quart', 'US qt', 'volume', 'us', 946.352946, ['quart', 'quarts', 'qt'], true),
  unit('us-gallon', 'US gallon', 'US gal', 'volume', 'us', 3785.411784, ['gallon', 'gallons', 'gal'], true),
  unit('us-tablespoon', 'US tablespoon', 'US tbsp', 'volume', 'us', 14.78676478125, ['tablespoon', 'tablespoons', 'tbsp'], true),
  unit('us-teaspoon', 'US teaspoon', 'US tsp', 'volume', 'us', 4.92892159375, ['teaspoon', 'teaspoons', 'tsp'], true),
];

export function formatFactor(factor: number): string {
  return new Intl.NumberFormat('en', { maximumSignificantDigits: 8 }).format(factor);
}

export const LIBRARY_ENTRIES: LibraryEntry[] = LIBRARY_UNITS.filter(u => u.scale !== 1).map(from => {
  const to = LIBRARY_UNITS.find(u => u.id === from.standardUnit)!;
  return { id: `${from.id}-to-${to.id}`, from, to, factor: from.scale,
    equation: `1 ${from.name.toLowerCase()} = ${formatFactor(from.scale)} ${to.abbreviation}` };
});

export function getConversionLibrary(params: { query?: string; system?: 'metric' | 'us'; dimension?: 'mass' | 'volume' } = {}) {
  const query = params.query?.trim().toLowerCase() ?? '';
  return {
    version: CATALOG_VERSION,
    source: CATALOG_SOURCE,
    presets: [
      { id: 'metric', name: 'Metric essentials', description: 'Grams, kilograms, liters and their smaller measures.' },
      { id: 'us', name: 'US customary', description: 'Cups, spoons, pounds and liquid measures, with explicit US definitions.' },
    ],
    entries: LIBRARY_ENTRIES.filter(e => (!params.system || e.from.system === params.system)
      && (!params.dimension || e.from.dimension === params.dimension)
      && `${e.equation} ${e.from.aliases.join(' ')} ${e.to.aliases.join(' ')}`.toLowerCase().includes(query)),
  };
}

export function factorsEqual(a: number, b: number): boolean {
  return Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0
    && Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * 1e-8;
}

// Mealie's StandardizedUnitType enum has these eight values; other measurements use a quantity of one of these standards.
export const STANDARD_SCALES: Record<string, { dimension: LibraryUnit['dimension']; scale: number }> = {
  gram: { dimension: 'mass', scale: 1 }, kilogram: { dimension: 'mass', scale: 1000 },
  milliliter: { dimension: 'volume', scale: 1 }, liter: { dimension: 'volume', scale: 1000 },
  ounce: { dimension: 'mass', scale: 28.349523125 }, pound: { dimension: 'mass', scale: 453.59237 },
  cup: { dimension: 'volume', scale: 236.5882365 }, fluid_ounce: { dimension: 'volume', scale: 29.5735295625 },
};

export function standardScale(standardUnit?: string | null, quantity?: number | null) {
  const standard = standardUnit ? STANDARD_SCALES[standardUnit] : undefined;
  if (!standard || !quantity || !Number.isFinite(quantity) || quantity <= 0) return null;
  return { dimension: standard.dimension, scale: standard.scale * quantity };
}

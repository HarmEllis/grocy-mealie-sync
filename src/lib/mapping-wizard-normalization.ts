import type { UpdateProductBody, UpdateQuantityUnitBody } from '@/lib/grocy/types';
import type { CreateIngredientFood } from '@/lib/mealie/client/models/CreateIngredientFood';
import type { IngredientFood_Output } from '@/lib/mealie/client/models/IngredientFood_Output';
import type { CreateIngredientUnit } from '@/lib/mealie/client/models/CreateIngredientUnit';
import type { IngredientUnit_Output } from '@/lib/mealie/client/models/IngredientUnit_Output';

function lowercaseValue(value?: string | null): string | null | undefined {
  if (value == null) {
    return value;
  }

  return value.trim().toLowerCase();
}

function lowercaseOptionalValue(value?: string | null): string | undefined {
  if (value == null) {
    return undefined;
  }

  return value.trim().toLowerCase();
}

export function capitalizeFirstCharacter(value: string): string {
  if (!value) {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function buildNormalizedMealieFoodUpdate(food: IngredientFood_Output): CreateIngredientFood | null {
  if (!food.id || !food.name) {
    return null;
  }

  const normalizedName = capitalizeFirstCharacter(food.name);
  const normalizedPluralName = food.pluralName ? capitalizeFirstCharacter(food.pluralName) : food.pluralName;

  if (food.name === normalizedName && food.pluralName === normalizedPluralName) {
    return null;
  }

  return {
    id: food.id,
    name: normalizedName,
    pluralName: normalizedPluralName,
    description: food.description,
    extras: food.extras,
    labelId: food.labelId,
    aliases: food.aliases?.map(a => ({ name: a.name })),
  };
}

export function buildNormalizedMealieUnitUpdate(unit: IngredientUnit_Output): CreateIngredientUnit | null {
  if (!unit.id || !unit.name) {
    return null;
  }

  const normalizedName = lowercaseValue(unit.name);
  const normalizedPluralName = lowercaseValue(unit.pluralName);
  const normalizedAbbreviation = lowercaseOptionalValue(unit.abbreviation);
  const normalizedPluralAbbreviation = lowercaseValue(unit.pluralAbbreviation);

  if (
    unit.name === normalizedName &&
    unit.pluralName === normalizedPluralName &&
    unit.abbreviation === normalizedAbbreviation &&
    unit.pluralAbbreviation === normalizedPluralAbbreviation
  ) {
    return null;
  }

  return {
    id: unit.id,
    name: normalizedName ?? unit.name,
    pluralName: normalizedPluralName,
    description: unit.description,
    extras: unit.extras,
    fraction: unit.fraction,
    abbreviation: normalizedAbbreviation,
    pluralAbbreviation: normalizedPluralAbbreviation ?? undefined,
    useAbbreviation: unit.useAbbreviation,
    aliases: unit.aliases?.map(a => ({ name: a.name })),
  };
}

export function buildNormalizedGrocyProductUpdate(product: { name?: string | null }): UpdateProductBody | null {
  if (!product.name) {
    return null;
  }

  const normalizedName = capitalizeFirstCharacter(product.name);
  if (product.name === normalizedName) {
    return null;
  }

  return { name: normalizedName };
}

export function buildNormalizedGrocyUnitUpdate(unit: { name?: string | null; name_plural?: string | null }): UpdateQuantityUnitBody | null {
  if (!unit.name) {
    return null;
  }

  const normalizedName = lowercaseValue(unit.name);
  const normalizedPluralName = lowercaseOptionalValue(unit.name_plural);

  if (unit.name === normalizedName && (unit.name_plural ?? undefined) === normalizedPluralName) {
    return null;
  }

  return {
    name: normalizedName ?? unit.name,
    name_plural: normalizedPluralName,
  };
}

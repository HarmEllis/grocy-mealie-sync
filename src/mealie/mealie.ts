import { z } from 'zod';
import { getEnvironmentVariable } from '../helpers/environment';
import logger from '../helpers/logger';
import { IngredientUnitPagination, IngredientUnit_Output } from '../types/mealie';

async function request<T extends z.ZodTypeAny>(
  resource: string,
  params: object,
  schema: T,
): Promise<z.infer<T>> {
  const url = getEnvironmentVariable('MEALIE_URL');
  const apiKey = getEnvironmentVariable('MEALIE_API_KEY');

  const response = await fetch(`${url}/api/${resource}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Error fetching ${resource}: ${response.statusText}`);
  }

  const data = await new Response(response.body).json();
  if (!data) {
    throw new Error(`No data returned from ${resource}`);
  } else {
    logger.silly(
      `Mealie: Retrieved object from resource ${resource} with the following keys:`,
      Object.keys(data),
    );
  }
  return schema.parse(data);
}

export async function getAllUnits(): Promise<IngredientUnit_Output[]> {
  try {
    const response: IngredientUnitPagination = await request('units', {}, IngredientUnitPagination);

    const units: IngredientUnit_Output[] = z.array(IngredientUnit_Output).parse(response.items);
    if (!units) {
      throw new Error('No units defined in Mealie');
    }
    return units;
  } catch (error) {
    logger.error('Mealie: Error fetching units', error);
    throw new Error(`Error fetching units: ${error}`);
  }
}

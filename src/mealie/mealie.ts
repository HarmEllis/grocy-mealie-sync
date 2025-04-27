import { getEnvironmentVariable } from '../helpers/environment';
import logger from '../helpers/logger';
import { ResponseList, Unit } from '../types/mealie';

async function request<T>(resource: string, params: object): Promise<T> {
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
  }
  return data as T;
}

export async function getAllUnits(): Promise<Unit[]> {
  try {
    const response = await request<ResponseList<Unit>>('units', {});
    const units = response.items;
    if (!units) {
      throw new Error('No units defined in Mealie');
    }
    logger.debug('Mealie:', ` Retreived ${units.length} units`);

    return units;
  } catch (error) {
    logger.error('Mealie:', 'Error fetching units', error);
    throw new Error(`Error fetching units: ${error}`);
  }
}

import { getGrocyEntities, type Location, type ProductGroup } from '@/lib/grocy/types';

export interface GrocyLocationEntry {
  id: number;
  name: string;
  description: string | null;
}

export interface GrocyProductGroupEntry {
  id: number;
  name: string;
  description: string | null;
}

export interface GrocyLocationsResult {
  count: number;
  locations: GrocyLocationEntry[];
}

export interface GrocyProductGroupsResult {
  count: number;
  productGroups: GrocyProductGroupEntry[];
}

export async function listGrocyLocations(): Promise<GrocyLocationsResult> {
  const entities = await getGrocyEntities('locations');
  const locations = entities
    .filter((e): e is Location & { id: number } => typeof e.id === 'number')
    .map(e => ({
      id: e.id,
      name: e.name || 'Unknown',
      description: e.description || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { count: locations.length, locations };
}

export async function listGrocyProductGroups(): Promise<GrocyProductGroupsResult> {
  const entities = await getGrocyEntities('product_groups');
  const groups = entities
    .filter((e): e is ProductGroup & { id: number } => typeof e.id === 'number')
    .map(e => ({
      id: e.id,
      name: e.name || 'Unknown',
      description: e.description || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { count: groups.length, productGroups: groups };
}

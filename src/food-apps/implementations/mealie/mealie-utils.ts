import { IngredientUnitOutput } from '../../../api-clients/mealie/types.gen';
import { Unit } from '../../base/food-app-types';
import logger from '../../../utils/logger';
import { FetchPaginatedPage, DataQuery, PaginatedResponse } from './mealie-types';

const DEFAULT_PAGE_SIZE = 50;

/**
 * Get all pages by using the pagination of the Mealie API.
 */
export async function fetchAllPaginatedItems<TItem>(
  fetchPage: FetchPaginatedPage<TItem>,
  baseParams: Omit<DataQuery, 'query.page'>,
): Promise<TItem[]> {
  let allItems: TItem[] = [];
  let page = 1;
  const perPage = baseParams.query?.perPage ?? DEFAULT_PAGE_SIZE;

  while (true) {
    const params = { ...baseParams, query: { ...baseParams.query, page, perPage } };
    const result = await fetchPage(params);
    if (result.error) throw new Error(JSON.stringify(result.error.detail));
    const data = result.data as PaginatedResponse<TItem>;
    logger.debug('Using params: ', params);
    allItems = allItems.concat(data.items ?? []);

    if (!data.next || data.page === data.total_pages) {
      break;
    }

    page++;
  }

  return allItems;
}

export function unitToMealieUnit(unit: Unit): IngredientUnitOutput {
  if (!unit.id) throw new Error('Unit must have an id');
  return {
    id: unit.id,
    name: unit.name,
    pluralName: unit.pluralName,
    description: unit.description,
    extras: unit.extras,
    fraction: unit.fraction,
    abbreviation: unit.abbreviation,
    pluralAbbreviation: unit.pluralAbbreviation,
    useAbbreviation: unit.useAbbreviation,
    aliases: unit.aliases?.map((alias) => ({ name: alias.name })),
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
  };
}

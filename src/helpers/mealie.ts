import {
  HttpValidationError,
  OrderByNullPosition,
  OrderDirection,
} from '../clients/mealie/types.gen';
import logger from './logger';

export type DataQuery = {
  query?: {
    orderBy?: string;
    orderByNullPosition?: OrderByNullPosition;
    orderDirection?: OrderDirection;
    queryFilter?: string;
    paginationSeed?: string;
    page?: number;
    perPage?: number;
    search?: string;
  };
};

type PaginatedResponse<T> = {
  items: T[];
  next?: string | null;
  page?: number;
  total_pages?: number;
};

type FetchPaginatedPage<T> = (
  options: DataQuery,
) => Promise<{ data: PaginatedResponse<T> | undefined; error: HttpValidationError | undefined }>;

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

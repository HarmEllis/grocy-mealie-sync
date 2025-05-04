import { HttpValidationError } from '../clients/mealie/types.gen';
import logger from './logger';

type GetDataRequest = {
  query?: {
    page?: number;
    perPage?: number;
  };
};

type PaginatedResponse<T> = {
  items: T[];
  next?: string | null;
  page?: number;
  total_pages?: number;
};

type FetchPaginatedPage<T> = (
  options: GetDataRequest,
) => Promise<{ data: PaginatedResponse<T> | undefined; error: HttpValidationError | undefined }>;

const DEFAULT_PAGE_SIZE = 50;

/**
 * Get all pages by using the pagination of the Mealie API.
 */
export async function fetchAllPaginatedItems<TItem>(
  fetchPage: FetchPaginatedPage<TItem>,
  baseParams: Omit<GetDataRequest, 'query.page'> & { query: { perPage?: number } },
): Promise<TItem[]> {
  let allItems: TItem[] = [];
  let page = 1;
  const perPage = baseParams.query.perPage ?? DEFAULT_PAGE_SIZE;

  while (true) {
    const params = { ...baseParams, query: { page, perPage } };
    const result = await fetchPage(params);
    if (result.error) throw new Error(result.error.detail?.join(', '));
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

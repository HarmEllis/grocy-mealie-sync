import {
  OrderByNullPosition,
  OrderDirection,
  HttpValidationError,
} from '../../../api-clients/mealie';

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
export type PaginatedResponse<T> = {
  items: T[];
  next?: string | null;
  page?: number;
  total_pages?: number;
};
export type FetchPaginatedPage<T> = (
  options: DataQuery,
) => Promise<{ data: PaginatedResponse<T> | undefined; error: HttpValidationError | undefined }>;

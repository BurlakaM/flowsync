import { PaginationQueryDto } from './pagination-query.dto';

export interface Page<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Prisma `skip`/`take` arguments for the requested page. */
export function paginationArgs({ page, limit }: PaginationQueryDto) {
  return { skip: (page - 1) * limit, take: limit };
}

/** Wraps a page of items and the total count into the response shape of list endpoints. */
export function toPage<T>(
  items: T[],
  total: number,
  { page, limit }: PaginationQueryDto,
): Page<T> {
  return {
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

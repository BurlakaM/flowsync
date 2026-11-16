/** Pagination metadata returned with every list (also used to document it in Swagger). */
export class PageMetaDto {
  page!: number;
  limit!: number;
  total!: number;
  totalPages!: number;
}

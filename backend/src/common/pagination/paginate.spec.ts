import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { paginationArgs, toPage } from './paginate';
import { PaginationQueryDto } from './pagination-query.dto';

const query = (page: number, limit: number) =>
  Object.assign(new PaginationQueryDto(), { page, limit });

describe('pagination', () => {
  it('computes skip and take for a page', () => {
    expect(paginationArgs(query(1, 20))).toEqual({ skip: 0, take: 20 });
    expect(paginationArgs(query(3, 10))).toEqual({ skip: 20, take: 10 });
  });

  it('wraps items with the page metadata', () => {
    expect(toPage(['a', 'b'], 45, query(2, 20))).toEqual({
      items: ['a', 'b'],
      meta: { page: 2, limit: 20, total: 45, totalPages: 3 },
    });
  });

  it('reports zero pages for an empty result', () => {
    expect(toPage([], 0, query(1, 20)).meta.totalPages).toBe(0);
  });

  describe('PaginationQueryDto', () => {
    const check = (plain: object) =>
      validate(plainToInstance(PaginationQueryDto, plain));

    it('defaults to the first page of 20', async () => {
      const dto = plainToInstance(PaginationQueryDto, {});

      expect(dto).toMatchObject({ page: 1, limit: 20 });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('converts query strings to numbers', async () => {
      const dto = plainToInstance(PaginationQueryDto, {
        page: '2',
        limit: '50',
      });

      expect(dto).toMatchObject({ page: 2, limit: 50 });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects a page below 1 and a limit above 100', async () => {
      expect(await check({ page: '0' })).toHaveLength(1);
      expect(await check({ limit: '101' })).toHaveLength(1);
      expect(await check({ limit: 'abc' })).toHaveLength(1);
    });
  });
});

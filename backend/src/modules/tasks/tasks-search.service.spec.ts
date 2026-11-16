import { mockDeep } from 'vitest-mock-extended';
import { PrismaService } from '../../database/prisma.service';
import { buildTsQuery, TasksSearchService } from './tasks-search.service';

describe('buildTsQuery', () => {
  it('requires every word and matches each one as a prefix', () => {
    expect(buildTsQuery('Fix login')).toBe('fix:* & login:*');
  });

  it('keeps Ukrainian letters and digits', () => {
    expect(buildTsQuery('Задача №42')).toBe('задача:* & 42:*');
  });

  it('drops everything that is not a letter or a digit, so tsquery syntax cannot be injected', () => {
    expect(buildTsQuery("x' | !(y) & z:*")).toBe('x:* & y:* & z:*');
  });

  it('returns null when nothing searchable is left', () => {
    expect(buildTsQuery('   ')).toBeNull();
    expect(buildTsQuery('!!! ???')).toBeNull();
  });

  it('limits the number of words', () => {
    const words = Array.from({ length: 30 }, (_, i) => `w${i}`).join(' ');

    expect(buildTsQuery(words)?.split(' & ')).toHaveLength(10);
  });
});

describe('TasksSearchService', () => {
  const prisma = mockDeep<PrismaService>();
  const service = new TasksSearchService(prisma);

  beforeEach(() => vi.resetAllMocks());

  it('does not touch the database when there is nothing to search for', async () => {
    expect(await service.rankedIds('!!!')).toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns the ids in the order the database ranked them', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 7 }, { id: 3 }, { id: 9 }]);

    expect(await service.rankedIds('login', 2)).toEqual([7, 3, 9]);
  });

  it('sends the tsquery and the project as parameters, never inside the SQL text', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await service.rankedIds("it's", 5);

    const [strings, ...values] = prisma.$queryRaw.mock.calls[0] as unknown as [
      TemplateStringsArray,
      ...unknown[],
    ];
    expect(strings.join('?')).not.toContain("it's");
    expect(values).toContain('it:* & s:*');
    expect(values).toContain(5);
  });
});

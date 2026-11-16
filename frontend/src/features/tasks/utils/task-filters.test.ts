import {
  applyTaskFilters,
  hasActiveFilters,
  parseTaskFilters,
} from './task-filters';

const parse = (query: string) => parseTaskFilters(new URLSearchParams(query));

describe('parseTaskFilters', () => {
  it('uses the defaults for an empty query', () => {
    expect(parse('')).toEqual({
      status: undefined,
      assigneeId: undefined,
      tagId: undefined,
      search: undefined,
      sortBy: 'createdAt',
      order: 'desc',
      page: 1,
    });
  });

  it('reads every filter', () => {
    expect(
      parse(
        'status=DONE&assigneeId=3&tagId=4&search=%20bug%20&sortBy=name&order=asc&page=2',
      ),
    ).toEqual({
      status: 'DONE',
      assigneeId: 3,
      tagId: 4,
      search: 'bug',
      sortBy: 'name',
      order: 'asc',
      page: 2,
    });
  });

  it('ignores anything unknown or malformed', () => {
    expect(
      parse(
        'status=NOPE&assigneeId=abc&tagId=-1&sortBy=password&order=up&page=0',
      ),
    ).toEqual(parse(''));
  });
});

describe('applyTaskFilters', () => {
  it('writes a filter and returns to the first page', () => {
    const next = applyTaskFilters(new URLSearchParams('page=3'), {
      status: 'TODO',
    });
    expect(next.toString()).toBe('status=TODO');
  });

  it('keeps the other filters and removes a cleared one', () => {
    const next = applyTaskFilters(new URLSearchParams('status=TODO&tagId=2'), {
      status: undefined,
    });
    expect(next.toString()).toBe('tagId=2');
  });

  it('changes only the page when the page is requested', () => {
    const next = applyTaskFilters(new URLSearchParams('status=TODO'), {
      page: 2,
    });
    expect(next.toString()).toBe('status=TODO&page=2');
  });

  it('leaves out the default ordering and keeps another one as a pair', () => {
    const named = applyTaskFilters(new URLSearchParams(), {
      sortBy: 'name',
      order: 'asc',
    });
    expect(named.toString()).toBe('sortBy=name&order=asc');

    const back = applyTaskFilters(named, {
      sortBy: 'createdAt',
      order: 'desc',
    });
    expect(back.toString()).toBe('');
  });

  it('keeps unrelated parameters untouched', () => {
    const next = applyTaskFilters(new URLSearchParams('tab=info'), {
      status: 'DONE',
    });
    expect(next.get('tab')).toBe('info');
  });
});

describe('hasActiveFilters', () => {
  it('is false for the defaults, ordering and page', () => {
    expect(hasActiveFilters(parse('sortBy=name&order=asc&page=3'))).toBe(false);
  });

  it('is true when something narrows the list', () => {
    expect(hasActiveFilters(parse('search=x'))).toBe(true);
    expect(hasActiveFilters(parse('status=DONE'))).toBe(true);
  });
});

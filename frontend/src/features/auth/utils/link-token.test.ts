import { readLinkToken } from './link-token';

const TOKEN = 'a'.repeat(43);

describe('readLinkToken', () => {
  it('reads the token from the fragment', () => {
    expect(readLinkToken(`#token=${TOKEN}`)).toBe(TOKEN);
  });

  it.each([
    '',
    '#',
    '#token=',
    '#other=abc',
    '#token=short',
    '#token=has space and more characters!',
  ])('returns null for %j', (hash) => {
    expect(readLinkToken(hash)).toBeNull();
  });
});

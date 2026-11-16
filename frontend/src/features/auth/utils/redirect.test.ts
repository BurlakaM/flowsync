import { buildLoginPath, getSafeRedirect } from './redirect';

describe('getSafeRedirect', () => {
  it.each([
    ['/projects/5', '/projects/5'],
    ['/tasks?status=DONE', '/tasks?status=DONE'],
    ['/', '/'],
  ])('keeps the local path %s', (value, expected) => {
    expect(getSafeRedirect(value)).toBe(expected);
  });

  it.each([
    ['nothing', null],
    ['an empty value', ''],
    ['an absolute URL', 'https://evil.example/steal'],
    ['a protocol-relative URL', '//evil.example'],
    ['a backslash trick', '/\\evil.example'],
    ['a relative path', 'projects'],
    ['the login page itself', '/login'],
    ['the login page with a query', '/login?redirectTo=%2F'],
  ])('falls back to the dashboard for %s', (_label, value) => {
    expect(getSafeRedirect(value)).toBe('/');
  });
});

describe('buildLoginPath', () => {
  it('encodes the place to return to', () => {
    expect(buildLoginPath('/projects?tab=a b')).toBe(
      '/login?redirectTo=%2Fprojects%3Ftab%3Da%20b',
    );
  });

  it('omits the parameter for the dashboard', () => {
    expect(buildLoginPath('/')).toBe('/login');
  });
});

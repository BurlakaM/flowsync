import { parseEnv } from './env';

describe('parseEnv', () => {
  it('defaults the API URL to the same-origin /api', () => {
    expect(parseEnv({})).toEqual({ VITE_API_URL: '/api' });
  });

  it('accepts a custom API URL', () => {
    expect(parseEnv({ VITE_API_URL: 'https://api.example.test' })).toEqual({
      VITE_API_URL: 'https://api.example.test',
    });
  });

  it('rejects an empty API URL', () => {
    expect(() => parseEnv({ VITE_API_URL: '' })).toThrow();
  });

  it('drops variables that are not part of the schema', () => {
    expect(parseEnv({ MODE: 'test', BASE_URL: '/' })).toEqual({
      VITE_API_URL: '/api',
    });
  });
});

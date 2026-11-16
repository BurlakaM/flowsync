import { authStorage } from './auth-storage';

describe('authStorage', () => {
  it('stores, reads and clears the token', () => {
    expect(authStorage.getToken()).toBeNull();
    expect(authStorage.hasToken()).toBe(false);

    authStorage.setToken('jwt-token');
    expect(authStorage.getToken()).toBe('jwt-token');
    expect(authStorage.hasToken()).toBe(true);

    authStorage.clear();
    expect(authStorage.getToken()).toBeNull();
  });

  it('never writes the token to localStorage', () => {
    authStorage.setToken('jwt-token');

    expect(JSON.stringify({ ...localStorage })).not.toContain('jwt-token');
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('removes the token that earlier versions left in localStorage', async () => {
    localStorage.setItem('access_token', 'old-session');

    vi.resetModules();
    await import('./auth-storage');

    expect(localStorage.getItem('access_token')).toBeNull();
  });
});

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

  it('keeps the key used by the previous frontend, so sessions survive', () => {
    localStorage.setItem('access_token', 'old-session');

    expect(authStorage.getToken()).toBe('old-session');
  });

  it('behaves as signed out when the storage is unavailable', () => {
    const blocked = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('storage is blocked');
      });

    expect(authStorage.getToken()).toBeNull();
    expect(authStorage.hasToken()).toBe(false);
    blocked.mockRestore();
  });
});

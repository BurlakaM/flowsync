import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const findByEmailForAuth = vi.fn();
  const sign = vi.fn();
  const verify = vi.fn();
  let service: AuthService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new AuthService(
      { findByEmailForAuth } as unknown as UsersService,
      { sign, verify } as unknown as JwtService,
    );
  });

  describe('validateUser', () => {
    it('returns null for an unknown email', async () => {
      findByEmailForAuth.mockResolvedValue(null);

      expect(
        await service.validateUser({ email: 'x@y.co', password: 'pw' }),
      ).toBeNull();
    });

    it('returns null for a wrong password', async () => {
      findByEmailForAuth.mockResolvedValue({
        id: 1,
        email: 'a@b.co',
        password: await bcrypt.hash('right', 4),
      });

      expect(
        await service.validateUser({ email: 'a@b.co', password: 'wrong' }),
      ).toBeNull();
    });

    it('returns the user without the password hash for valid credentials', async () => {
      findByEmailForAuth.mockResolvedValue({
        id: 1,
        email: 'a@b.co',
        password: await bcrypt.hash('right', 4),
      });

      const user = await service.validateUser({
        email: 'a@b.co',
        password: 'right',
      });

      expect(user).toEqual({ id: 1, email: 'a@b.co' });
    });
  });

  it('signs a token whose subject is the user id', () => {
    sign.mockReturnValue('signed-token');

    expect(service.login({ id: 9, email: 'a@b.co' })).toEqual({
      access_token: 'signed-token',
    });
    expect(sign).toHaveBeenCalledWith({ email: 'a@b.co', sub: 9 });
  });

  describe('validateToken', () => {
    it('is true for a token that verifies', () => {
      verify.mockReturnValue({ sub: 1 });

      expect(service.validateToken('t')).toBe(true);
    });

    it('is false when verification throws', () => {
      verify.mockImplementation(() => {
        throw new Error('invalid');
      });

      expect(service.validateToken('t')).toBe(false);
    });
  });
});

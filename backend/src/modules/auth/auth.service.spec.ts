import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const findByEmailForAuth = vi.fn();
  const createUser = vi.fn();
  const getProfile = vi.fn();
  const sign = vi.fn();
  let service: AuthService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new AuthService(
      { findByEmailForAuth, createUser, getProfile } as unknown as UsersService,
      { sign } as unknown as JwtService,
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

  it('registers through the users service', async () => {
    const dto = { name: 'A', email: 'a@b.co', password: 'password-123' };
    createUser.mockResolvedValue({ id: 1 });

    expect(await service.register(dto)).toEqual({ id: 1 });
    expect(createUser).toHaveBeenCalledWith(dto);
  });

  it('returns the profile of the current user', async () => {
    getProfile.mockResolvedValue({ id: 5 });

    expect(await service.me(5)).toEqual({ id: 5 });
    expect(getProfile).toHaveBeenCalledWith(5);
  });
});

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

const context = {
  getHandler: () => undefined,
  getClass: () => undefined,
} as unknown as ExecutionContext;

function createGuard(isPublic: boolean | undefined) {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;
  return new JwtAuthGuard(reflector);
}

describe('JwtAuthGuard', () => {
  // The passport guard is the parent class; spy on it to see whether the token check is reached.
  const passportCanActivate = vi.spyOn(
    Object.getPrototypeOf(JwtAuthGuard.prototype),
    'canActivate',
  );

  beforeEach(() => {
    passportCanActivate.mockReset().mockResolvedValue(true);
  });

  it('skips authentication for routes marked @Public()', () => {
    expect(createGuard(true).canActivate(context)).toBe(true);
    expect(passportCanActivate).not.toHaveBeenCalled();
  });

  it('requires a valid token for every other route', async () => {
    await createGuard(undefined).canActivate(context);

    expect(passportCanActivate).toHaveBeenCalledTimes(1);
  });
});

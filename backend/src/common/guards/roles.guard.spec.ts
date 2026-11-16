import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../types/role.type';
import { RolesGuard } from './roles.guard';

function createContext(user?: { role: Role }) {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function createGuard(required: Role[] | undefined) {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(required),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('lets everyone in when the route has no @Roles()', () => {
    expect(createGuard(undefined).canActivate(createContext())).toBe(true);
    expect(createGuard([]).canActivate(createContext())).toBe(true);
  });

  it('lets a user with a required role in', () => {
    const guard = createGuard([Role.Admin]);

    expect(guard.canActivate(createContext({ role: Role.Admin }))).toBe(true);
  });

  it('rejects a user without the required role', () => {
    const guard = createGuard([Role.Admin]);

    expect(() => guard.canActivate(createContext({ role: Role.User }))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects a request without a user', () => {
    const guard = createGuard([Role.Admin]);

    expect(() => guard.canActivate(createContext())).toThrow(
      ForbiddenException,
    );
  });
});

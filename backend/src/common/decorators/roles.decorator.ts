import { SetMetadata } from '@nestjs/common';
import { Role } from '../types/role.type';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given roles (checked by the global RolesGuard). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

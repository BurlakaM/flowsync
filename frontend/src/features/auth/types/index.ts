import type { Schemas } from '@/types/api';

/** The current user as returned by GET /auth/me. */
export type User = Schemas['UserResponseDto'];
export type Role = User['role'];

export type RegisterInput = Schemas['CreateUserDto'];
export type LoginInput = Schemas['LoginDto'];
export type LoginResponse = Schemas['LoginResponseDto'];

export type Role = 'USER' | 'ADMIN';

/** The current user as returned by GET /auth/me. */
export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** The field name is kept in snake_case by the API for now (renamed in plan phase 6). */
export interface LoginResponse {
  access_token: string;
}

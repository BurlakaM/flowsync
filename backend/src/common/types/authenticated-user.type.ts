/** The user attached to the request by JwtStrategy after the token is verified. */
export interface AuthenticatedUser {
  id: number;
  email: string;
}

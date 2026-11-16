export class LoginResponseDto {
  /** A signed JWT; send it as `Authorization: Bearer <token>`. */
  access_token!: string;
}

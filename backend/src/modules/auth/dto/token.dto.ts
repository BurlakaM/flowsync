import {
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** The raw token from an emailed link: 32 random bytes in base64url, i.e. 43 characters. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

export class VerifyEmailDto {
  @IsString()
  @Length(20, 128)
  @Matches(TOKEN_PATTERN, { message: 'token is not valid' })
  token!: string;
}

export class ResetPasswordDto extends VerifyEmailDto {
  // bcrypt only uses the first 72 bytes of a password.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}

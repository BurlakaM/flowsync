import { IsEmail, IsString, MinLength } from 'class-validator';

// The role is never accepted from the client: new users always get the default role.
export class CreateUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

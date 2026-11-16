import { IsEmail, MaxLength } from 'class-validator';
import { NormalizeEmail } from '../../../common/decorators/transform.decorators';

export class AddMemberDto {
  /** The email of a registered user. */
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(255)
  email!: string;
}

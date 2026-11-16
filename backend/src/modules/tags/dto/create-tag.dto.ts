import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../common/decorators/transform.decorators';

export class CreateTagDto {
  /** Unique inside the project. */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;
}

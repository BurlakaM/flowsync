import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../common/decorators/transform.decorators';

// The author is taken from the access token and the task from the URL, never from the body.
export class CreateCommentDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  text!: string;
}

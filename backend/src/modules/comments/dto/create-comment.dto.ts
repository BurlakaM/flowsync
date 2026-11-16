import { IsInt, IsNotEmpty, IsString } from 'class-validator';

// The author is taken from the access token, not from the request body.
export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsInt()
  taskId!: number;
}

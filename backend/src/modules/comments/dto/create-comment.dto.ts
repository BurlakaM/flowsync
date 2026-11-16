import { IsNumber, IsString } from 'class-validator';

// The author is taken from the access token, not from the request body.
export class CreateCommentDto {
  @IsString()
  text!: string;

  @IsNumber()
  task_id!: number;
}

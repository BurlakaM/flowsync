import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// The author is taken from the access token, not from the request body.
export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  projectId!: number;
}

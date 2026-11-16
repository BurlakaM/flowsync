import { TaskStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../../common/decorators/transform.decorators';

// The author is taken from the access token and the project from the URL, never from the body.
export class CreateTaskDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  /** Defaults to TODO. */
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  /** User ids; every assignee must be the owner or a member of the project. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsInt({ each: true })
  assigneeIds?: number[];

  /** Tag ids; every tag must belong to the same project. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsInt({ each: true })
  tagIds?: number[];
}

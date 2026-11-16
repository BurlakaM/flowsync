import { TaskStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../../common/decorators/transform.decorators';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';

/** `relevance` orders by the quality of the match and only makes sense together with `search`. */
export const TASK_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'relevance',
] as const;

export class QueryTasksDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assigneeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tagId?: number;

  /** Only for GET /tasks (across projects); the nested route takes it from the URL. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  /** Full-text search over the name, the description and the comments; every word must match, as a prefix. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(TASK_SORT_FIELDS)
  sortBy: (typeof TASK_SORT_FIELDS)[number] = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}

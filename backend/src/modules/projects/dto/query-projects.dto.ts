import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../common/decorators/transform.decorators';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';

export class QueryProjectsDto extends PaginationQueryDto {
  /** Matches the project name (case-insensitive). */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;
}

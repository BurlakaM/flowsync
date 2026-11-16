import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../common/decorators/transform.decorators';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';

export class QueryUsersDto extends PaginationQueryDto {
  /** Matches the name or the email (case-insensitive). */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;
}

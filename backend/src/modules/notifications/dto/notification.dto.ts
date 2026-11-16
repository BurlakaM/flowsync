import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PageMetaDto } from '../../../common/pagination/page-meta.dto';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';

export class QueryNotificationsDto extends PaginationQueryDto {
  /** Only the notifications that have not been read. */
  @ApiPropertyOptional()
  @IsOptional()
  // Query strings are text: only "true" and "false" are understood, anything else fails validation.
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  unread?: boolean;
}

export class NotificationResponseDto {
  id!: number;

  /** `task.assigned`, `comment.added` or `project.invited`. */
  type!: string;

  /** Names and ids the client needs to write the sentence and to link to the target. */
  @ApiProperty({ type: 'object', additionalProperties: true })
  data!: Record<string, unknown>;

  /** Null while unread. */
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readAt!: Date | null;

  createdAt!: Date;
}

export class NotificationPageDto {
  @ApiProperty({ type: () => [NotificationResponseDto] })
  items!: NotificationResponseDto[];

  meta!: PageMetaDto;
}

export class UnreadCountDto {
  count!: number;
}

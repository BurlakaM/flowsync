import { ApiProperty } from '@nestjs/swagger';
import { UserSummaryDto } from '../../../common/dto/user-summary.dto';

export class ActivityResponseDto {
  id!: number;

  /** What happened, e.g. `task.created` or `comment.deleted`. */
  type!: string;

  entityType!: string;

  /** The id of the task, comment, tag, project or (for members) user it is about. */
  entityId!: number;

  /** Facts about the event, e.g. the name of a task or the old and new status. */
  @ApiProperty({ type: 'object', additionalProperties: true })
  data!: Record<string, unknown>;

  /** Null when the account of the author was deleted. */
  @ApiProperty({ type: () => UserSummaryDto, nullable: true })
  actor!: UserSummaryDto | null;

  /** Format: date-time */
  createdAt!: Date;
}

export class ActivityPageDto {
  @ApiProperty({ type: () => [ActivityResponseDto] })
  items!: ActivityResponseDto[];

  /** Pass it as `cursor` to get the next page; null on the last one. */
  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

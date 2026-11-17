import { ApiProperty } from '@nestjs/swagger';
import { UserSummaryDto } from '../../../common/dto/user-summary.dto';

export class CommentResponseDto {
  id!: number;
  text!: string;
  taskId!: number;
  /** Null when the author's account was deleted. */
  author!: UserSummaryDto | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class CommentPageDto {
  items!: CommentResponseDto[];
  /** Pass it as `cursor` to get the next page; null on the last one. */
  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

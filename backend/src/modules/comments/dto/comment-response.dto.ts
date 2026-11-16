import { UserSummaryDto } from '../../../common/dto/user-summary.dto';
import { PageMetaDto } from '../../../common/pagination/page-meta.dto';

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
  meta!: PageMetaDto;
}

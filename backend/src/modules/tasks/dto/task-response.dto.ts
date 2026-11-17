import { TaskStatus } from '@prisma/client';
import { UserSummaryDto } from '../../../common/dto/user-summary.dto';
import { PageMetaDto } from '../../../common/pagination/page-meta.dto';

export class TaskTagDto {
  id!: number;
  name!: string;
}

export class TaskProjectDto {
  id!: number;
  name!: string;
}

export class TaskResponseDto {
  id!: number;
  name!: string;
  description!: string | null;
  status!: TaskStatus;
  /** Send it back with every update (optimistic concurrency). */
  version!: number;
  projectId!: number;
  /** Null when the author's account was deleted. */
  createdById!: number | null;
  assignees!: UserSummaryDto[];
  tags!: TaskTagDto[];
  commentsCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

export class TaskDetailsDto extends TaskResponseDto {
  project!: TaskProjectDto;
  createdBy!: UserSummaryDto | null;
}

export class TaskPageDto {
  items!: TaskResponseDto[];
  meta!: PageMetaDto;
}

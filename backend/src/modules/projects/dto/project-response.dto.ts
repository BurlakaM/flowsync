import { UserSummaryDto } from '../../../common/dto/user-summary.dto';
import { PageMetaDto } from '../../../common/pagination/page-meta.dto';
import { ProjectRole } from '../project-role.type';

export class ProjectResponseDto {
  id!: number;
  name!: string;
  description!: string | null;
  /** Whether the project has a picture; fetch it from `GET /projects/{id}/image`. */
  hasImage!: boolean;
  ownerId!: number;
  /** The role of the current user in this project. */
  myRole!: ProjectRole;
  tasksCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

export class MemberResponseDto {
  userId!: number;
  name!: string;
  email!: string;
  role!: ProjectRole;
  joinedAt!: Date;
}

export class ProjectDetailsDto extends ProjectResponseDto {
  owner!: UserSummaryDto;
  /** The owner first, then the other members. */
  members!: MemberResponseDto[];
}

export class ProjectPageDto {
  items!: ProjectResponseDto[];
  meta!: PageMetaDto;
}

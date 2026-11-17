import { PageMetaDto } from '../../../common/pagination/page-meta.dto';
import { Role } from '../../../common/types/role.type';

export class UserResponseDto {
  id!: number;
  name!: string;
  email!: string;
  role!: Role;
  /** Null until the email address is confirmed with the link that was sent to it. */
  emailVerifiedAt!: Date | null;
  createdAt!: Date;
}

export class UserPageDto {
  items!: UserResponseDto[];
  meta!: PageMetaDto;
}

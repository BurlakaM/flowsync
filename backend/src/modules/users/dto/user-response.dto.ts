import { PageMetaDto } from '../../../common/pagination/page-meta.dto';
import { Role } from '../../../common/types/role.type';

export class UserResponseDto {
  id!: number;
  name!: string;
  email!: string;
  role!: Role;
  createdAt!: Date;
}

export class UserPageDto {
  items!: UserResponseDto[];
  meta!: PageMetaDto;
}

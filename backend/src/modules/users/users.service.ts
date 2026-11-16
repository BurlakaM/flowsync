import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  paginationArgs,
  toPage,
  type Page,
} from '../../common/pagination/paginate';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';

// Fields that are safe to return to clients. Never add `password` here.
export const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  /** The role is never set here: the schema default (USER) applies. */
  async createUser(dto: CreateUserDto): Promise<UserResponseDto> {
    const hashedPassword = await bcrypt.hash(
      dto.password,
      this.config.bcryptRounds,
    );
    return this.prisma.user.create({
      data: { name: dto.name, email: dto.email, password: hashedPassword },
      select: userSelect,
    });
  }

  async getProfile(id: number): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Changing the password requires the current one. */
  async updateProfile(
    id: number,
    dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;

    if (dto.newPassword !== undefined) {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: { password: true },
      });
      if (!user) throw new NotFoundException('User not found');

      const isCurrentValid = await bcrypt.compare(
        dto.currentPassword ?? '',
        user.password,
      );
      if (!isCurrentValid) {
        throw new BadRequestException('Current password is incorrect');
      }
      data.password = await bcrypt.hash(
        dto.newPassword,
        this.config.bcryptRounds,
      );
    }

    return this.prisma.user.update({ where: { id }, data, select: userSelect });
  }

  async list(query: QueryUsersDto): Promise<Page<UserResponseDto>> {
    const where: Prisma.UserWhereInput = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...paginationArgs(query),
      }),
      this.prisma.user.count({ where }),
    ]);
    return toPage(items, total, query);
  }

  /**
   * Internal use only (login): returns the password hash.
   * Never return the result of this method from a controller.
   */
  findByEmailForAuth(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}

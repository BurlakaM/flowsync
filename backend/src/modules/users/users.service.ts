import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { UserDto } from './user.dto';
import * as bcrypt from 'bcryptjs';

const DEFAULT_ROLE_NAME = 'user';

// Fields that are safe to return to clients. Never add `password` here.
export const userSelect = {
  id: true,
  name: true,
  email: true,
  role_id: true,
} satisfies Prisma.userSelect;

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  // Створення користувача
  async createUser(dto: UserDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const defaultRole = await this.prisma.role.findFirstOrThrow({
      where: { name: DEFAULT_ROLE_NAME },
    });
    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: {
          connect: {
            id: defaultRole.id,
          },
        },
      },
      select: userSelect,
    });
  }

  async getProfile(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Internal use only (login): returns the password hash.
   * Never return the result of this method from a controller.
   */
  findByEmailForAuth(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email },
    });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

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
  constructor(private readonly prisma: PrismaService) {}

  /** The role is never set here: the schema default (USER) applies. */
  async createUser(dto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: { name: dto.name, email: dto.email, password: hashedPassword },
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
    return this.prisma.user.findUnique({ where: { email } });
  }
}

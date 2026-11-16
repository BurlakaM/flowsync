import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateCommentDto) {
    // A user may comment only on tasks they can see: own, assigned to them, or in their project.
    const task = await this.prisma.task.findFirst({
      where: {
        id: dto.task_id,
        OR: [
          { user_id: userId },
          { project: { user_id: userId } },
          { task_assignment: { some: { user_id: userId } } },
        ],
      },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Task not found');

    return this.prisma.comment.create({
      data: {
        text: dto.text,
        user: { connect: { id: userId } },
        task: { connect: { id: task.id } },
      },
    });
  }
}

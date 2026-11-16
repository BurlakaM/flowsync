import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  getTasks(userId: number) {
    return this.prisma.task.findMany({ where: { createdById: userId } });
  }

  async create(userId: number, dto: CreateTaskDto) {
    // Only the project owner may add tasks; someone else's project looks like a missing one.
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, ownerId: userId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.task.create({
      data: {
        name: dto.name,
        description: dto.description,
        createdBy: { connect: { id: userId } },
        project: { connect: { id: project.id } },
      },
    });
  }
}

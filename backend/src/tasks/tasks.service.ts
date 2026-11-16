import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TasksDto } from './tasks.dto';
import { UserService } from '../users/users.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userService: UserService,
  ) {}

  getTasks(userId: number) {
    return this.prismaService.task.findMany({
      where: {
        user_id: userId,
      },
    });
  }

  async create(userId: number, dto: TasksDto) {
    // Only the project owner may add tasks; someone else's project looks like a missing one.
    const project = await this.prismaService.project.findFirst({
      where: { id: dto.project_id, user_id: userId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    return this.prismaService.task.create({
      data: {
        name: dto.name,
        description: dto.description,
        user: {
          connect: {
            id: userId,
          },
        },
        project: {
          connect: {
            id: project.id,
          },
        },
      },
    });
  }
}

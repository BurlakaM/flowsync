import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  paginationArgs,
  toPage,
  type Page,
} from '../../common/pagination/paginate';
import { PrismaService } from '../../database/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { TaskDetailsDto, TaskResponseDto } from './dto/task-response.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const taskSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  projectId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  assignees: {
    select: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  },
  tags: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskSelect;

const taskDetailsSelect = {
  ...taskSelect,
  project: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.TaskSelect;

type TaskRow = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;
type TaskDetailsRow = Prisma.TaskGetPayload<{
  select: typeof taskDetailsSelect;
}>;

function toResponse(task: TaskRow): TaskResponseDto {
  const { assignees, _count, ...fields } = task;
  return {
    ...fields,
    assignees: assignees.map((assignee) => assignee.user),
    commentsCount: _count.comments,
  };
}

function toDetails(task: TaskDetailsRow): TaskDetailsDto {
  const { project, createdBy, ...row } = task;
  return { ...toResponse(row), project, createdBy };
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  /**
   * Tasks of the projects the user can see. `projectId` (from the URL) narrows the list to one
   * project and makes a foreign project a 404 instead of an empty page.
   */
  async list(
    userId: number,
    query: QueryTasksDto,
    projectId?: number,
  ): Promise<Page<TaskResponseDto>> {
    if (projectId !== undefined) {
      await this.projects.assertAccess(userId, projectId);
    }
    const scopeProjectId = projectId ?? query.projectId;

    const where: Prisma.TaskWhereInput = {
      project: this.projects.accessFilter(userId),
      ...(scopeProjectId !== undefined && { projectId: scopeProjectId }),
      ...(query.status && { status: query.status }),
      ...(query.assigneeId !== undefined && {
        assignees: { some: { userId: query.assigneeId } },
      }),
      ...(query.tagId !== undefined && {
        tags: { some: { id: query.tagId } },
      }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    // sortBy is validated against TASK_SORT_FIELDS, so the computed key is always a real column.
    const sort = {
      [query.sortBy]: query.order,
    } as Prisma.TaskOrderByWithRelationInput;

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        select: taskSelect,
        orderBy: [sort, { id: 'desc' }],
        ...paginationArgs(query),
      }),
      this.prisma.task.count({ where }),
    ]);
    return toPage(tasks.map(toResponse), total, query);
  }

  async create(
    userId: number,
    projectId: number,
    dto: CreateTaskDto,
  ): Promise<TaskDetailsDto> {
    await this.projects.assertAccess(userId, projectId);
    await this.assertAssigneesAreMembers(projectId, dto.assigneeIds);
    await this.assertTagsBelongToProject(projectId, dto.tagIds);

    const task = await this.prisma.task.create({
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
        project: { connect: { id: projectId } },
        createdBy: { connect: { id: userId } },
        ...(dto.assigneeIds?.length && {
          assignees: {
            create: dto.assigneeIds.map((assigneeId) => ({
              userId: assigneeId,
            })),
          },
        }),
        ...(dto.tagIds?.length && {
          tags: { connect: dto.tagIds.map((id) => ({ id })) },
        }),
      },
      select: taskDetailsSelect,
    });
    return toDetails(task);
  }

  async get(userId: number, id: number): Promise<TaskDetailsDto> {
    const task = await this.prisma.task.findFirst({
      where: { id, project: this.projects.accessFilter(userId) },
      select: taskDetailsSelect,
    });
    if (!task) throw new NotFoundException('Task not found');
    return toDetails(task);
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateTaskDto,
  ): Promise<TaskDetailsDto> {
    const { projectId } = await this.assertTaskAccess(userId, id);
    await this.assertAssigneesAreMembers(projectId, dto.assigneeIds);
    await this.assertTagsBelongToProject(projectId, dto.tagIds);

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
        // When sent, the lists replace the current ones (the whole update is one transaction).
        ...(dto.assigneeIds !== undefined && {
          assignees: {
            deleteMany: {},
            create: dto.assigneeIds.map((assigneeId) => ({
              userId: assigneeId,
            })),
          },
        }),
        ...(dto.tagIds !== undefined && {
          tags: { set: dto.tagIds.map((tagId) => ({ id: tagId })) },
        }),
      },
      select: taskDetailsSelect,
    });
    return toDetails(task);
  }

  /** Only the author or the project owner may delete a task. */
  async remove(userId: number, id: number): Promise<void> {
    const task = await this.assertTaskAccess(userId, id);
    if (task.createdById !== userId && task.project.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the author or the project owner can delete a task',
      );
    }
    await this.prisma.task.delete({ where: { id } });
  }

  /** For other modules (comments): the task, when the user can see its project. */
  async assertTaskAccess(userId: number, id: number) {
    const task = await this.prisma.task.findFirst({
      where: { id, project: this.projects.accessFilter(userId) },
      select: {
        id: true,
        projectId: true,
        createdById: true,
        project: { select: { ownerId: true } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private async assertAssigneesAreMembers(
    projectId: number,
    assigneeIds?: number[],
  ): Promise<void> {
    if (!assigneeIds?.length) return;
    const members = await this.prisma.user.count({
      where: {
        id: { in: assigneeIds },
        OR: [
          { ownedProjects: { some: { id: projectId } } },
          { memberships: { some: { projectId } } },
        ],
      },
    });
    if (members !== assigneeIds.length) {
      throw new BadRequestException('Assignees must be members of the project');
    }
  }

  private async assertTagsBelongToProject(
    projectId: number,
    tagIds?: number[],
  ): Promise<void> {
    if (!tagIds?.length) return;
    const tags = await this.prisma.tag.count({
      where: { id: { in: tagIds }, projectId },
    });
    if (tags !== tagIds.length) {
      throw new BadRequestException('Tags must belong to the project');
    }
  }
}

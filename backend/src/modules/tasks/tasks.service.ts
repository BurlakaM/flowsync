import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { subject } from '@casl/ability';
import { Prisma } from '@prisma/client';
import { authorize } from '../../common/casl/authorize';
import {
  paginationArgs,
  toPage,
  type Page,
} from '../../common/pagination/paginate';
import type { DomainEvent } from '../../common/events/domain-event';
import {
  DomainEventsService,
  type EmitEvent,
} from '../../common/events/domain-events.service';
import { PrismaService } from '../../database/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { TasksSearchService } from './tasks-search.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { TaskDetailsDto, TaskResponseDto } from './dto/task-response.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const taskSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  version: true,
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
    private readonly search: TasksSearchService,
    private readonly events: DomainEventsService,
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
    };

    // The search runs first and narrows the list to the matching ids; access and the other
    // filters still apply to them, so a search can never reveal a task of a foreign project.
    const rankedIds = query.search
      ? await this.search.rankedIds(query.search, scopeProjectId)
      : undefined;
    if (rankedIds) where.id = { in: rankedIds };

    if (rankedIds && query.sortBy === 'relevance') {
      return this.listByRelevance(where, rankedIds, query);
    }

    // Without a search there is nothing to rank: "relevance" then means the default order.
    const sortField = query.sortBy === 'relevance' ? 'createdAt' : query.sortBy;
    // sortField is validated against TASK_SORT_FIELDS, so the computed key is always a real column.
    const sort = {
      [sortField]: query.order,
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

  /** Best match first: the order comes from the search, so the page is cut from the ranked ids. */
  private async listByRelevance(
    where: Prisma.TaskWhereInput,
    rankedIds: number[],
    query: QueryTasksDto,
  ): Promise<Page<TaskResponseDto>> {
    const visible = await this.prisma.task.findMany({
      where,
      select: { id: true },
    });
    const visibleIds = new Set(visible.map((task) => task.id));
    const ordered = rankedIds.filter((id) => visibleIds.has(id));
    const { skip, take } = paginationArgs(query);
    const pageIds = ordered.slice(skip, skip + take);

    const rows = await this.prisma.task.findMany({
      where: { id: { in: pageIds } },
      select: taskSelect,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const items = pageIds.flatMap((id) => {
      const row = byId.get(id);
      return row ? [toResponse(row)] : [];
    });
    return toPage(items, ordered.length, query);
  }

  async create(
    userId: number,
    projectId: number,
    dto: CreateTaskDto,
  ): Promise<TaskDetailsDto> {
    await this.projects.assertAccess(userId, projectId);
    await this.assertAssigneesAreMembers(projectId, dto.assigneeIds);
    await this.assertTagsBelongToProject(projectId, dto.tagIds);

    const task = await this.events.transact(async (tx, emit) => {
      const created = await tx.task.create({
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
      emit({
        type: 'task.created',
        actorId: userId,
        projectId,
        entityType: 'Task',
        entityId: created.id,
        data: {
          name: created.name,
          status: created.status,
          assigneeIds: created.assignees.map((assignee) => assignee.user.id),
        },
      });
      return created;
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
    const before = await this.assertTaskAccess(userId, id);
    const { projectId } = before;
    await this.assertAssigneesAreMembers(projectId, dto.assigneeIds);
    await this.assertTagsBelongToProject(projectId, dto.tagIds);

    const task = await this.updateIfCurrent(id, async (tx, emit) => {
      // The check and the write are one statement: two concurrent updates cannot both win.
      const updated = await tx.task.update({
        where: { id, version: dto.version },
        data: {
          name: dto.name,
          description: dto.description,
          status: dto.status,
          version: { increment: 1 },
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
      emit(this.updatedEvent(userId, before, updated));
      return updated;
    });
    return toDetails(task);
  }

  /**
   * Runs the update and turns "nothing matched" into the right error: the task is gone (404) or
   * somebody saved it first (409). The lookup happens after the failed transaction, not inside it.
   */
  private async updateIfCurrent(
    id: number,
    work: (
      tx: Prisma.TransactionClient,
      emit: EmitEvent,
    ) => Promise<TaskDetailsRow>,
  ): Promise<TaskDetailsRow> {
    try {
      return await this.events.transact(work);
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2025'
      ) {
        throw error;
      }
      const current = await this.prisma.task.findUnique({
        where: { id },
        select: { version: true },
      });
      if (!current) throw new NotFoundException('Task not found');
      throw new ConflictException(
        'The task was changed by someone else. Review the latest version and apply your change again',
      );
    }
  }

  /** Only the author or the project owner may delete a task. */
  async remove(userId: number, id: number): Promise<void> {
    const task = await this.assertTaskAccess(userId, id);
    authorize(
      userId,
      task.project,
      'delete',
      subject('Task', { createdById: task.createdById }),
      'Only the author or the project owner can delete a task',
    );
    await this.events.transact(async (tx, emit) => {
      await tx.task.delete({ where: { id } });
      emit({
        type: 'task.deleted',
        actorId: userId,
        projectId: task.projectId,
        entityType: 'Task',
        entityId: id,
        data: { name: task.name },
      });
    });
  }

  /** Describes what an update changed: the feed shows it and notifications use the new assignees. */
  private updatedEvent(
    userId: number,
    before: Awaited<ReturnType<TasksService['assertTaskAccess']>>,
    after: TaskDetailsRow,
  ): DomainEvent {
    const beforeAssignees = before.assignees.map((assignee) => assignee.userId);
    const afterAssignees = after.assignees.map((assignee) => assignee.user.id);
    const assigneesAdded = afterAssignees.filter(
      (assigneeId) => !beforeAssignees.includes(assigneeId),
    );
    const ids = (list: { id: number }[]) =>
      list
        .map((item) => item.id)
        .sort((a, b) => a - b)
        .join(',');

    const changed = [
      before.name !== after.name && 'name',
      before.description !== after.description && 'description',
      before.status !== after.status && 'status',
      (assigneesAdded.length > 0 ||
        beforeAssignees.length !== afterAssignees.length) &&
        'assignees',
      ids(before.tags) !== ids(after.tags) && 'tags',
    ].filter(Boolean);

    return {
      type: 'task.updated',
      actorId: userId,
      projectId: after.projectId,
      entityType: 'Task',
      entityId: after.id,
      data: {
        name: after.name,
        changed,
        ...(before.status !== after.status && {
          status: { from: before.status, to: after.status },
        }),
        assigneesAdded,
      },
    };
  }

  /** For other modules (comments): the task, when the user can see its project. */
  async assertTaskAccess(userId: number, id: number) {
    const task = await this.prisma.task.findFirst({
      where: { id, project: this.projects.accessFilter(userId) },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        projectId: true,
        createdById: true,
        assignees: { select: { userId: true } },
        tags: { select: { id: true } },
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

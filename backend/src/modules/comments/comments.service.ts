import { Injectable, NotFoundException } from '@nestjs/common';
import { subject } from '@casl/ability';
import { Prisma } from '@prisma/client';
import { authorize } from '../../common/casl/authorize';
import {
  CursorQueryDto,
  decodeCursor,
  toCursorPage,
  type CursorPage,
} from '../../common/pagination/cursor';
import { DomainEventsService } from '../../common/events/domain-events.service';
import { PrismaService } from '../../database/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { CommentResponseDto } from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

const commentSelect = {
  id: true,
  text: true,
  taskId: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } },
} satisfies Prisma.CommentSelect;

/** Long comments are cut for the feed and for notifications. */
const excerpt = (text: string) =>
  text.length > 140 ? `${text.slice(0, 140)}…` : text;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly tasks: TasksService,
    private readonly events: DomainEventsService,
  ) {}

  /** Oldest first, like a conversation; by cursor, so new comments never shift the pages already read. */
  async list(
    userId: number,
    taskId: number,
    query: CursorQueryDto,
  ): Promise<CursorPage<CommentResponseDto>> {
    await this.tasks.assertTaskAccess(userId, taskId);

    const after = decodeCursor(query.cursor);
    const rows = await this.prisma.comment.findMany({
      where: { taskId, ...(after !== undefined && { id: { gt: after } }) },
      select: commentSelect,
      orderBy: { id: 'asc' },
      take: query.limit + 1,
    });
    return toCursorPage(rows, query.limit);
  }

  /** Any member of the task's project can comment. */
  async create(
    userId: number,
    taskId: number,
    dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    const task = await this.tasks.assertTaskAccess(userId, taskId);
    return this.events.transact(async (tx, emit) => {
      const comment = await tx.comment.create({
        data: {
          text: dto.text,
          task: { connect: { id: taskId } },
          author: { connect: { id: userId } },
        },
        select: commentSelect,
      });
      emit({
        type: 'comment.created',
        actorId: userId,
        projectId: task.projectId,
        entityType: 'Comment',
        entityId: comment.id,
        data: {
          taskId,
          taskName: task.name,
          excerpt: excerpt(comment.text),
        },
      });
      return comment;
    });
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateCommentDto,
  ): Promise<CommentResponseDto> {
    const comment = await this.findAccessible(userId, id);
    authorize(
      userId,
      comment.task.project,
      'update',
      subject('Comment', { authorId: comment.authorId }),
      'Only the author can edit a comment',
    );
    return this.events.transact(async (tx, emit) => {
      const updated = await tx.comment.update({
        where: { id },
        data: { text: dto.text },
        select: commentSelect,
      });
      emit({
        type: 'comment.updated',
        actorId: userId,
        projectId: comment.task.projectId,
        entityType: 'Comment',
        entityId: id,
        data: { taskId: comment.task.id, taskName: comment.task.name },
      });
      return updated;
    });
  }

  /** The author may delete their comment; the project owner may moderate. */
  async remove(userId: number, id: number): Promise<void> {
    const comment = await this.findAccessible(userId, id);
    authorize(
      userId,
      comment.task.project,
      'delete',
      subject('Comment', { authorId: comment.authorId }),
      'Only the author or the project owner can delete a comment',
    );
    await this.events.transact(async (tx, emit) => {
      await tx.comment.delete({ where: { id } });
      emit({
        type: 'comment.deleted',
        actorId: userId,
        projectId: comment.task.projectId,
        entityType: 'Comment',
        entityId: id,
        data: { taskId: comment.task.id, taskName: comment.task.name },
      });
    });
  }

  private async findAccessible(userId: number, id: number) {
    const comment = await this.prisma.comment.findFirst({
      where: {
        id,
        task: { project: this.projects.accessFilter(userId) },
      },
      select: {
        id: true,
        authorId: true,
        task: {
          select: {
            id: true,
            name: true,
            projectId: true,
            project: { select: { ownerId: true } },
          },
        },
      },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }
}

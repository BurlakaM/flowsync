import { Injectable, NotFoundException } from '@nestjs/common';
import { subject } from '@casl/ability';
import { Prisma } from '@prisma/client';
import { authorize } from '../../common/casl/authorize';
import {
  paginationArgs,
  toPage,
  type Page,
} from '../../common/pagination/paginate';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
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

  /** Oldest first, like a conversation. */
  async list(
    userId: number,
    taskId: number,
    query: PaginationQueryDto,
  ): Promise<Page<CommentResponseDto>> {
    await this.tasks.assertTaskAccess(userId, taskId);

    const [items, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { taskId },
        select: commentSelect,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.comment.count({ where: { taskId } }),
    ]);
    return toPage(items, total, query);
  }

  /** Any member of the task's project can comment. */
  async create(
    userId: number,
    taskId: number,
    dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    const task = await this.tasks.assertTaskAccess(userId, taskId);
    const comment = await this.prisma.comment.create({
      data: {
        text: dto.text,
        task: { connect: { id: taskId } },
        author: { connect: { id: userId } },
      },
      select: commentSelect,
    });
    await this.events.publish({
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
    const updated = await this.prisma.comment.update({
      where: { id },
      data: { text: dto.text },
      select: commentSelect,
    });
    await this.events.publish({
      type: 'comment.updated',
      actorId: userId,
      projectId: comment.task.projectId,
      entityType: 'Comment',
      entityId: id,
      data: { taskId: comment.task.id, taskName: comment.task.name },
    });
    return updated;
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
    await this.prisma.comment.delete({ where: { id } });
    await this.events.publish({
      type: 'comment.deleted',
      actorId: userId,
      projectId: comment.task.projectId,
      entityType: 'Comment',
      entityId: id,
      data: { taskId: comment.task.id, taskName: comment.task.name },
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

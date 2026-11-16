import {
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
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
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

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly tasks: TasksService,
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
    await this.tasks.assertTaskAccess(userId, taskId);
    return this.prisma.comment.create({
      data: {
        text: dto.text,
        task: { connect: { id: taskId } },
        author: { connect: { id: userId } },
      },
      select: commentSelect,
    });
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateCommentDto,
  ): Promise<CommentResponseDto> {
    const comment = await this.findAccessible(userId, id);
    if (comment.authorId !== userId) {
      throw new ForbiddenException('Only the author can edit a comment');
    }
    return this.prisma.comment.update({
      where: { id },
      data: { text: dto.text },
      select: commentSelect,
    });
  }

  /** The author may delete their comment; the project owner may moderate. */
  async remove(userId: number, id: number): Promise<void> {
    const comment = await this.findAccessible(userId, id);
    if (
      comment.authorId !== userId &&
      comment.task.project.ownerId !== userId
    ) {
      throw new ForbiddenException(
        'Only the author or the project owner can delete a comment',
      );
    }
    await this.prisma.comment.delete({ where: { id } });
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
        task: { select: { project: { select: { ownerId: true } } } },
      },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }
}

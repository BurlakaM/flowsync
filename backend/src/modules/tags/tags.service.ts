import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { authorize } from '../../common/casl/authorize';
import { DomainEventsService } from '../../common/events/domain-events.service';
import { PrismaService } from '../../database/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { TagResponseDto } from './dto/tag-response.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

const tagSelect = {
  id: true,
  name: true,
  projectId: true,
  createdAt: true,
} satisfies Prisma.TagSelect;

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly events: DomainEventsService,
  ) {}

  /** Tags are a short reference list, so they are returned without pagination. */
  async list(userId: number, projectId: number): Promise<TagResponseDto[]> {
    await this.projects.assertAccess(userId, projectId);
    return this.prisma.tag.findMany({
      where: { projectId },
      select: tagSelect,
      orderBy: { name: 'asc' },
    });
  }

  /** Any member of the project can create tags. */
  async create(
    userId: number,
    projectId: number,
    dto: CreateTagDto,
  ): Promise<TagResponseDto> {
    await this.projects.assertAccess(userId, projectId);
    await this.assertNameIsFree(projectId, dto.name);
    return this.events.transact(async (tx, emit) => {
      const tag = await tx.tag.create({
        data: { name: dto.name, projectId },
        select: tagSelect,
      });
      emit({
        type: 'tag.created',
        actorId: userId,
        projectId,
        entityType: 'Tag',
        entityId: tag.id,
        data: { name: tag.name },
      });
      return tag;
    });
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateTagDto,
  ): Promise<TagResponseDto> {
    const tag = await this.findAccessible(userId, id);
    if (tag.name !== dto.name)
      await this.assertNameIsFree(tag.projectId, dto.name);
    return this.events.transact(async (tx, emit) => {
      const updated = await tx.tag.update({
        where: { id },
        data: { name: dto.name },
        select: tagSelect,
      });
      emit({
        type: 'tag.updated',
        actorId: userId,
        projectId: tag.projectId,
        entityType: 'Tag',
        entityId: id,
        data: { name: updated.name, renamedFrom: tag.name },
      });
      return updated;
    });
  }

  /** Owner only: deleting a tag removes it from every task of the project. */
  async remove(userId: number, id: number): Promise<void> {
    const tag = await this.findAccessible(userId, id);
    authorize(
      userId,
      tag.project,
      'delete',
      'Tag',
      'Only the project owner can delete tags',
    );
    await this.events.transact(async (tx, emit) => {
      await tx.tag.delete({ where: { id } });
      emit({
        type: 'tag.deleted',
        actorId: userId,
        projectId: tag.projectId,
        entityType: 'Tag',
        entityId: id,
        data: { name: tag.name },
      });
    });
  }

  private async findAccessible(userId: number, id: number) {
    const tag = await this.prisma.tag.findFirst({
      where: { id, project: this.projects.accessFilter(userId) },
      select: {
        id: true,
        name: true,
        projectId: true,
        project: { select: { ownerId: true } },
      },
    });
    if (!tag) throw new NotFoundException('Tag not found');
    return tag;
  }

  private async assertNameIsFree(projectId: number, name: string) {
    const existing = await this.prisma.tag.findUnique({
      where: { projectId_name: { projectId, name } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A tag with this name already exists');
    }
  }
}

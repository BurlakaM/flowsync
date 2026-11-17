import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { subject } from '@casl/ability';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { authorize } from '../../common/casl/authorize';
import {
  paginationArgs,
  toPage,
  type Page,
} from '../../common/pagination/paginate';
import { DomainEventsService } from '../../common/events/domain-events.service';
import { StorageService } from '../../common/storage/storage.service';
import { detectImageType } from '../../common/storage/image-type';
import type { StoredObject } from '../../common/storage/object-store';
import { PrismaService } from '../../database/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import {
  MemberResponseDto,
  ProjectDetailsDto,
  ProjectResponseDto,
} from './dto/project-response.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectRole } from './project-role.type';

const projectSelect = {
  id: true,
  name: true,
  description: true,
  image: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { tasks: true } },
} satisfies Prisma.ProjectSelect;

type ProjectRow = Prisma.ProjectGetPayload<{ select: typeof projectSelect }>;

const memberSelect = {
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ProjectMemberSelect;

function toResponse(project: ProjectRow, userId: number): ProjectResponseDto {
  // The storage key stays inside the server.
  const { _count, image, ...fields } = project;
  return {
    ...fields,
    hasImage: image !== null,
    myRole: project.ownerId === userId ? ProjectRole.OWNER : ProjectRole.MEMBER,
    tasksCount: _count.tasks,
  };
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventsService,
    private readonly storage: StorageService,
  ) {}

  /** Prisma filter for "projects the user may see": the user owns them or is a member. */
  accessFilter(userId: number): Prisma.ProjectWhereInput {
    return {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    };
  }

  /** A project the user cannot see looks like a missing one (404). */
  async assertAccess(
    userId: number,
    projectId: number,
  ): Promise<{ id: number; ownerId: number; name: string }> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ...this.accessFilter(userId) },
      select: { id: true, ownerId: true, name: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async create(
    userId: number,
    dto: CreateProjectDto,
  ): Promise<ProjectResponseDto> {
    const project = await this.events.transact(async (tx, emit) => {
      const created = await tx.project.create({
        data: { ...dto, ownerId: userId },
        select: projectSelect,
      });
      emit({
        type: 'project.created',
        actorId: userId,
        projectId: created.id,
        entityType: 'Project',
        entityId: created.id,
        data: { name: created.name },
      });
      return created;
    });
    return toResponse(project, userId);
  }

  async list(
    userId: number,
    query: QueryProjectsDto,
  ): Promise<Page<ProjectResponseDto>> {
    const where: Prisma.ProjectWhereInput = {
      ...this.accessFilter(userId),
      ...(query.search && {
        name: { contains: query.search, mode: 'insensitive' },
      }),
    };

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        select: projectSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        ...paginationArgs(query),
      }),
      this.prisma.project.count({ where }),
    ]);
    return toPage(
      projects.map((project) => toResponse(project, userId)),
      total,
      query,
    );
  }

  async get(userId: number, id: number): Promise<ProjectDetailsDto> {
    const project = await this.prisma.project.findFirst({
      where: { id, ...this.accessFilter(userId) },
      select: {
        ...projectSelect,
        owner: { select: { id: true, name: true, email: true } },
        members: { select: memberSelect, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');

    const { owner, members, ...summary } = project;
    return {
      ...toResponse(summary, userId),
      owner: { id: owner.id, name: owner.name },
      members: [
        {
          userId: owner.id,
          name: owner.name,
          email: owner.email,
          role: ProjectRole.OWNER,
          joinedAt: project.createdAt,
        },
        ...members.map((member) => ({
          userId: member.user.id,
          name: member.user.name,
          email: member.user.email,
          role: ProjectRole.MEMBER,
          joinedAt: member.createdAt,
        })),
      ],
    };
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    const current = await this.assertAccess(userId, id);
    authorize(
      userId,
      current,
      'update',
      'Project',
      'Only the project owner can do this',
    );
    const project = await this.events.transact(async (tx, emit) => {
      const updated = await tx.project.update({
        where: { id },
        data: dto,
        select: projectSelect,
      });
      emit({
        type: 'project.updated',
        actorId: userId,
        projectId: id,
        entityType: 'Project',
        entityId: id,
        data: {
          name: updated.name,
          renamedFrom: current.name !== updated.name ? current.name : undefined,
        },
      });
      return updated;
    });
    return toResponse(project, userId);
  }

  /** Deletes the project together with its tasks, comments and tags. */
  async remove(userId: number, id: number): Promise<void> {
    const project = await this.assertAccess(userId, id);
    authorize(
      userId,
      project,
      'delete',
      'Project',
      'Only the project owner can do this',
    );
    const stored = await this.prisma.project.findUnique({
      where: { id },
      select: { image: true },
    });
    await this.events.transact(async (tx, emit) => {
      await tx.project.delete({ where: { id } });
      emit({
        type: 'project.deleted',
        actorId: userId,
        projectId: id,
        entityType: 'Project',
        entityId: id,
        data: {},
      });
    });
    // The row is gone; a picture that cannot be removed is only a leftover.
    if (stored?.image) await this.storage.remove(stored.image);
  }

  /** Owner only. Replaces the picture; the old one is deleted from the storage. */
  async setImage(
    userId: number,
    projectId: number,
    file: { buffer: Buffer },
  ): Promise<ProjectResponseDto> {
    const current = await this.assertAccess(userId, projectId);
    authorize(
      userId,
      current,
      'update',
      'Project',
      'Only the project owner can do this',
    );
    // The bytes decide, not the name or the Content-Type that the client claims.
    const type = detectImageType(file.buffer);
    if (!type) {
      throw new BadRequestException(
        'The file must be a PNG, JPEG or WebP image',
      );
    }

    const key = `projects/${projectId}/${randomUUID()}.${type.extension}`;
    await this.storage.put(key, file.buffer, type.mime);

    const previous = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { image: true },
    });
    const project = await this.events.transact(async (tx, emit) => {
      const updated = await tx.project.update({
        where: { id: projectId },
        data: { image: key },
        select: projectSelect,
      });
      emit({
        type: 'project.updated',
        actorId: userId,
        projectId,
        entityType: 'Project',
        entityId: projectId,
        data: { name: updated.name, image: 'changed' },
      });
      return updated;
    });
    if (previous?.image) await this.storage.remove(previous.image);
    return toResponse(project, userId);
  }

  /** Owner only. Removing a picture that is not there is not an error. */
  async removeImage(userId: number, projectId: number): Promise<void> {
    const current = await this.assertAccess(userId, projectId);
    authorize(
      userId,
      current,
      'update',
      'Project',
      'Only the project owner can do this',
    );
    const stored = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { image: true },
    });
    if (!stored?.image) return;

    await this.events.transact(async (tx, emit) => {
      await tx.project.update({
        where: { id: projectId },
        data: { image: null },
      });
      emit({
        type: 'project.updated',
        actorId: userId,
        projectId,
        entityType: 'Project',
        entityId: projectId,
        data: { name: current.name, image: 'removed' },
      });
    });
    await this.storage.remove(stored.image);
  }

  /** Anyone who can see the project can see its picture; everyone else gets the usual 404. */
  async getImage(userId: number, projectId: number): Promise<StoredObject> {
    await this.assertAccess(userId, projectId);
    const stored = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { image: true },
    });
    const object = stored?.image ? await this.storage.get(stored.image) : null;
    if (!object) throw new NotFoundException('The project has no picture');
    return object;
  }

  async listMembers(
    userId: number,
    projectId: number,
  ): Promise<MemberResponseDto[]> {
    return (await this.get(userId, projectId)).members;
  }

  async addMember(
    userId: number,
    projectId: number,
    dto: AddMemberDto,
  ): Promise<MemberResponseDto> {
    const project = await this.assertAccess(userId, projectId);
    authorize(
      userId,
      project,
      'create',
      'Member',
      'Only the project owner can do this',
    );

    const target = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, name: true, email: true },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.id === project.ownerId) {
      throw new ConflictException('The user already owns this project');
    }
    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: target.id } },
      select: { userId: true },
    });
    if (existing) throw new ConflictException('The user is already a member');

    const member = await this.events.transact(async (tx, emit) => {
      const created = await tx.projectMember.create({
        data: { projectId, userId: target.id },
        select: { createdAt: true },
      });
      emit({
        type: 'member.added',
        actorId: userId,
        projectId,
        entityType: 'Member',
        entityId: target.id,
        data: { name: target.name },
      });
      return created;
    });
    return {
      userId: target.id,
      name: target.name,
      email: target.email,
      role: ProjectRole.MEMBER,
      joinedAt: member.createdAt,
    };
  }

  /** The owner may remove anyone; a member may only remove themselves (leave). */
  async removeMember(
    userId: number,
    projectId: number,
    targetUserId: number,
  ): Promise<void> {
    const project = await this.assertAccess(userId, projectId);
    if (targetUserId === project.ownerId) {
      throw new BadRequestException('The owner cannot be removed');
    }
    authorize(
      userId,
      project,
      'delete',
      subject('Member', { userId: targetUserId }),
      'Only the project owner can remove others',
    );

    const removed = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { name: true },
    });
    await this.events.transact(async (tx, emit) => {
      const { count } = await tx.projectMember.deleteMany({
        where: { projectId, userId: targetUserId },
      });
      // Thrown inside the transaction: nothing is deleted and no event is stored.
      if (count === 0) throw new NotFoundException('Member not found');
      emit({
        type: 'member.removed',
        actorId: userId,
        projectId,
        entityType: 'Member',
        entityId: targetUserId,
        data: { name: removed?.name },
      });
    });
  }
}

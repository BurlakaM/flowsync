import {
  BadRequestException,
  ConflictException,
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
  const { _count, ...fields } = project;
  return {
    ...fields,
    myRole: project.ownerId === userId ? ProjectRole.OWNER : ProjectRole.MEMBER,
    tasksCount: _count.tasks,
  };
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

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
  ): Promise<{ id: number; ownerId: number }> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ...this.accessFilter(userId) },
      select: { id: true, ownerId: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async assertOwner(userId: number, projectId: number) {
    const project = await this.assertAccess(userId, projectId);
    if (project.ownerId !== userId) {
      throw new ForbiddenException('Only the project owner can do this');
    }
    return project;
  }

  async create(
    userId: number,
    dto: CreateProjectDto,
  ): Promise<ProjectResponseDto> {
    const project = await this.prisma.project.create({
      data: { ...dto, ownerId: userId },
      select: projectSelect,
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
    await this.assertOwner(userId, id);
    const project = await this.prisma.project.update({
      where: { id },
      data: dto,
      select: projectSelect,
    });
    return toResponse(project, userId);
  }

  /** Deletes the project together with its tasks, comments and tags. */
  async remove(userId: number, id: number): Promise<void> {
    await this.assertOwner(userId, id);
    await this.prisma.project.delete({ where: { id } });
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
    const project = await this.assertOwner(userId, projectId);

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

    const member = await this.prisma.projectMember.create({
      data: { projectId, userId: target.id },
      select: { createdAt: true },
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
    if (userId !== project.ownerId && userId !== targetUserId) {
      throw new ForbiddenException('Only the project owner can remove others');
    }

    const { count } = await this.prisma.projectMember.deleteMany({
      where: { projectId, userId: targetUserId },
    });
    if (count === 0) throw new NotFoundException('Member not found');
  }
}

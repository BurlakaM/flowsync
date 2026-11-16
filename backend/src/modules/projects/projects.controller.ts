import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import {
  MemberResponseDto,
  ProjectDetailsDto,
  ProjectPageDto,
  ProjectResponseDto,
} from './dto/project-response.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @ApiCreatedResponse({ type: ProjectResponseDto })
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projects.create(user.id, dto);
  }

  /** Projects the user owns or is a member of. */
  @ApiOkResponse({ type: ProjectPageDto })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryProjectsDto,
  ) {
    return this.projects.list(user.id, query);
  }

  @ApiOkResponse({ type: ProjectDetailsDto })
  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.projects.get(user.id, id);
  }

  @ApiOkResponse({ type: ProjectResponseDto })
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(user.id, id, dto);
  }

  /** Owner only. Also deletes the tasks, comments and tags of the project. */
  @ApiNoContentResponse()
  @HttpCode(204)
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.projects.remove(user.id, id);
  }

  @ApiOkResponse({ type: [MemberResponseDto] })
  @Get(':id/members')
  listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.projects.listMembers(user.id, id);
  }

  /** Owner only. The user must already be registered. */
  @ApiCreatedResponse({ type: MemberResponseDto })
  @Post(':id/members')
  addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddMemberDto,
  ) {
    return this.projects.addMember(user.id, id, dto);
  }

  /** The owner removes anyone; a member can only remove themselves. */
  @ApiNoContentResponse()
  @HttpCode(204)
  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.projects.removeMember(user.id, id, userId);
  }
}

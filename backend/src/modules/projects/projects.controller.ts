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
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
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

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

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

  /**
   * Owner only. A multipart request with the picture in the `file` field: PNG, JPEG or WebP, up to 2 MB.
   * The type is checked on the bytes of the file, not on its name.
   */
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: ProjectResponseDto })
  @UseInterceptors(
    FileInterceptor('file', {
      // Larger files are refused while they are read (413), not after they are in memory.
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    }),
  )
  @Put(':id/image')
  setImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file?: { buffer: Buffer },
  ) {
    if (!file) {
      throw new BadRequestException('Send the picture in the "file" field');
    }
    return this.projects.setImage(user.id, id, file);
  }

  /** Owner only. */
  @ApiNoContentResponse()
  @HttpCode(204)
  @Delete(':id/image')
  removeImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.projects.removeImage(user.id, id);
  }

  /** The picture of the project (the bytes of the image) for everyone who can see the project. */
  @ApiOkResponse({
    content: {
      'image/*': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @Get(':id/image')
  async getImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) response: Response,
  ) {
    const image = await this.projects.getImage(user.id, id);
    response.set({
      'Content-Type': image.contentType,
      // Private: the picture belongs to the members, no shared cache may keep it.
      'Cache-Control': 'private, max-age=300',
      'Content-Disposition': 'inline',
    });
    return new StreamableFile(image.body);
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

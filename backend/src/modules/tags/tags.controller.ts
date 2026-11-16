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
import { CreateTagDto } from './dto/create-tag.dto';
import { TagResponseDto } from './dto/tag-response.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagsService } from './tags.service';

@ApiTags('tags')
@ApiBearerAuth()
@Controller()
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @ApiOkResponse({ type: [TagResponseDto] })
  @Get('projects/:projectId/tags')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.tags.list(user.id, projectId);
  }

  @ApiCreatedResponse({ type: TagResponseDto })
  @Post('projects/:projectId/tags')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateTagDto,
  ) {
    return this.tags.create(user.id, projectId, dto);
  }

  @ApiOkResponse({ type: TagResponseDto })
  @Patch('tags/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTagDto,
  ) {
    return this.tags.update(user.id, id, dto);
  }

  /** Owner only. */
  @ApiNoContentResponse()
  @HttpCode(204)
  @Delete('tags/:id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tags.remove(user.id, id);
  }
}

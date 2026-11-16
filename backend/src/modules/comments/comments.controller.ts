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
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CommentsService } from './comments.service';
import { CommentPageDto, CommentResponseDto } from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@ApiTags('comments')
@ApiBearerAuth()
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @ApiOkResponse({ type: CommentPageDto })
  @Get('tasks/:taskId/comments')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.comments.list(user.id, taskId, query);
  }

  @ApiCreatedResponse({ type: CommentResponseDto })
  @Post('tasks/:taskId/comments')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(user.id, taskId, dto);
  }

  /** Author only. */
  @ApiOkResponse({ type: CommentResponseDto })
  @Patch('comments/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.comments.update(user.id, id, dto);
  }

  /** The author or the project owner. */
  @ApiNoContentResponse()
  @HttpCode(204)
  @Delete('comments/:id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.comments.remove(user.id, id);
  }
}

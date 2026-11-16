import {Body, Controller, Post, UseGuards} from '@nestjs/common';
import { CommentsService } from './comments.service';
import {CommentsDto} from "./comments.dto";
import {JwtAuthGuard} from "../conception/jwt.auth.guard";
import {CurrentUser} from "../common/decorators/current-user.decorator";
import {AuthenticatedUser} from "../common/types/authenticated-user.type";

@Controller('comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  createComment(@CurrentUser() user: AuthenticatedUser, @Body() dto: CommentsDto) {
    return this.commentsService.create(user.id, dto);
  }
}

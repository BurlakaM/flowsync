import {Body, Controller, Post, UsePipes, ValidationPipe} from '@nestjs/common';
import { CommentsService } from './comments.service';
import {CommentsDto} from "./comments.dto";
import {PrismaService} from "../prisma.service";

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService, private readonly prismaService: PrismaService) {}

  @Post()
  @UsePipes(ValidationPipe)
  createTask(@Body() dto: CommentsDto) {
    return this.commentsService.create(dto);
  }
}

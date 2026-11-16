import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksDto } from './tasks.dto';
import { JwtAuthGuard } from '../conception/jwt.auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  getTasks(@CurrentUser() user: AuthenticatedUser) {
    return this.tasksService.getTasks(user.id);
  }

  @Post()
  createTask(@CurrentUser() user: AuthenticatedUser, @Body() dto: TasksDto) {
    return this.tasksService.create(user.id, dto);
  }
}

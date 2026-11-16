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
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { TaskDetailsDto, TaskPageDto } from './dto/task-response.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  /** Tasks of every project the user can see; filter with ?projectId=, ?status=, ?assigneeId=, ?tagId=. */
  @ApiOkResponse({ type: TaskPageDto })
  @Get('tasks')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryTasksDto) {
    return this.tasks.list(user.id, query);
  }

  @ApiOkResponse({ type: TaskPageDto })
  @Get('projects/:projectId/tasks')
  listInProject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: QueryTasksDto,
  ) {
    return this.tasks.list(user.id, query, projectId);
  }

  /** Any member of the project can create tasks. */
  @ApiCreatedResponse({ type: TaskDetailsDto })
  @Post('projects/:projectId/tasks')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.create(user.id, projectId, dto);
  }

  @ApiOkResponse({ type: TaskDetailsDto })
  @Get('tasks/:id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tasks.get(user.id, id);
  }

  @ApiOkResponse({ type: TaskDetailsDto })
  @Patch('tasks/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(user.id, id, dto);
  }

  /** Only the author or the project owner. */
  @ApiNoContentResponse()
  @HttpCode(204)
  @Delete('tasks/:id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tasks.remove(user.id, id);
  }
}

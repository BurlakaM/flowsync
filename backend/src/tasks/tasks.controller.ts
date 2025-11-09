import {Body, Controller, Get, Post, UseGuards, UsePipes, ValidationPipe, Request} from '@nestjs/common';
import { TasksService } from './tasks.service';
import {TasksDto} from "./tasks.dto";
import {JwtAuthGuard} from "../conception/jwt.auth.guard";

@Controller('tasks')
// @UseInterceptors(LoggingInterceptor)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getTasks(@Request() req) {
    return this.tasksService.getTasks(req.user);
  }
  @Post()
  @UsePipes(ValidationPipe)
  createTask(@Body() dto: TasksDto) {
    return this.tasksService.create(dto);
  }

}

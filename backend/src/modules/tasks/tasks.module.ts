import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { TasksController } from './tasks.controller';
import { TasksSearchService } from './tasks-search.service';
import { TasksService } from './tasks.service';

@Module({
  imports: [ProjectsModule],
  controllers: [TasksController],
  providers: [TasksService, TasksSearchService],
  exports: [TasksService],
})
export class TasksModule {}

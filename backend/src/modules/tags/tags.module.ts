import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  imports: [ProjectsModule],
  controllers: [TagsController],
  providers: [TagsService],
})
export class TagsModule {}

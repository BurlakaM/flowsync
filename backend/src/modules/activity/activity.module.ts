import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { AuditLogListener } from './audit-log.listener';

@Module({
  imports: [ProjectsModule],
  controllers: [ActivityController],
  providers: [ActivityService, AuditLogListener],
})
export class ActivityModule {}

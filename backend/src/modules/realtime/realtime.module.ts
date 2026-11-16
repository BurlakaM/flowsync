import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [ProjectsModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}

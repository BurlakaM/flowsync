import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DomainEventsService } from './domain-events.service';

/** Global: every module that changes data publishes through `DomainEventsService`. */
@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [DomainEventsService],
  exports: [DomainEventsService],
})
export class EventsModule {}

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import {
  DOMAIN_EVENT,
  type DeliveredDomainEvent,
} from '../../common/events/domain-event';
import { PrismaService } from '../../database/prisma.service';

/** Writes every domain event to the audit log, which feeds the activity of a project. */
@Injectable()
export class AuditLogListener {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Errors are not caught on purpose: a failure makes the outbox retry the event. Redelivery is safe
   * because `eventId` is unique and `skipDuplicates` turns the second insert into a no-op.
   */
  @OnEvent(DOMAIN_EVENT)
  async record(event: DeliveredDomainEvent): Promise<void> {
    // A deleted project takes its log with it (cascade): there is nothing left to attach the row to.
    if (event.type === 'project.deleted') return;

    await this.prisma.auditLog.createMany({
      data: [
        {
          projectId: event.projectId,
          actorId: event.actorId,
          type: event.type,
          entityType: event.entityType,
          entityId: event.entityId,
          data: event.data as Prisma.InputJsonObject,
          eventId: event.id,
        },
      ],
      skipDuplicates: true,
    });
  }
}

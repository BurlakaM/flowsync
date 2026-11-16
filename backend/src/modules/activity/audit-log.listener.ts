import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import {
  DOMAIN_EVENT,
  type DomainEvent,
} from '../../common/events/domain-event';
import { PrismaService } from '../../database/prisma.service';

/** Writes every domain event to the audit log, which feeds the activity of a project. */
@Injectable()
export class AuditLogListener {
  private readonly logger = new Logger(AuditLogListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(DOMAIN_EVENT)
  async record(event: DomainEvent): Promise<void> {
    // A deleted project takes its log with it (cascade): there is nothing left to attach the row to.
    if (event.type === 'project.deleted') return;

    try {
      await this.prisma.auditLog.create({
        data: {
          projectId: event.projectId,
          actorId: event.actorId,
          type: event.type,
          entityType: event.entityType,
          entityId: event.entityId,
          data: event.data as Prisma.InputJsonObject,
        },
      });
    } catch (error) {
      // The change itself is already saved: losing a log row must not turn into an error for the user.
      this.logger.error(
        `Could not record ${event.type}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

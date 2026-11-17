import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import {
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import {
  DOMAIN_EVENT,
  type DomainEvent,
} from '../../common/events/domain-event';
import { MetricsService } from '../../metrics/metrics.service';
import { PrismaService } from '../../database/prisma.service';
import { NOTIFICATIONS_CREATED } from '../notifications/notifications.events';
import { ProjectsService } from '../projects/projects.service';

/** What a client learns: that something changed, and where. The data itself it fetches over the API. */
export interface RealtimeEvent {
  type: string;
  projectId: number;
  entityType: string;
  entityId: number;
  taskId?: number;
}

const projectRoom = (projectId: number) => `project:${projectId}`;
const userRoom = (userId: number) => `user:${userId}`;

/**
 * Live updates over socket.io. The connection is authenticated with the access token, and a client joins
 * only the rooms of projects it may see: so it can never hear about a project it has no access to.
 *
 * The path lives under /api so that the same proxy rule that serves the API serves the socket.
 */
@WebSocketGateway({ path: '/api/socket.io' })
export class RealtimeGateway implements OnGatewayInit {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly metrics: MetricsService,
  ) {}

  afterInit(server: Server): void {
    this.metrics.registerGauge(
      {
        name: 'flowsync_websocket_connections',
        help: 'Open live-update sockets',
      },
      (gauge) => gauge.set(server.sockets.sockets.size),
    );
    server.use((socket, next) => {
      this.authenticate(socket).then(
        () => next(),
        () => next(new Error('unauthorized')),
      );
    });
    server.on('connection', (socket) => {
      void this.joinRooms(socket);
    });
  }

  /** The token comes in the handshake (`auth.token`), never in the URL, so it does not end up in logs. */
  private async authenticate(socket: Socket): Promise<void> {
    const token: unknown = socket.handshake.auth?.token;
    if (typeof token !== 'string') throw new Error('no token');

    const payload = await this.jwt.verifyAsync<{ sub: number }>(token);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true },
    });
    if (!user) throw new Error('unknown user');
    socket.data.userId = user.id;
  }

  private async joinRooms(socket: Socket): Promise<void> {
    const userId: number = socket.data.userId;
    try {
      const projects = await this.prisma.project.findMany({
        where: this.projects.accessFilter(userId),
        select: { id: true },
      });
      await socket.join([
        userRoom(userId),
        ...projects.map((project) => projectRoom(project.id)),
      ]);
      socket.emit('ready');
    } catch (error) {
      this.logger.error(
        `Could not join rooms: ${error instanceof Error ? error.message : String(error)}`,
      );
      socket.disconnect(true);
    }
  }

  @OnEvent(DOMAIN_EVENT)
  onDomainEvent(event: DomainEvent): void {
    if (!this.server) return;
    const room = projectRoom(event.projectId);
    const payload: RealtimeEvent = {
      type: event.type,
      projectId: event.projectId,
      entityType: event.entityType,
      entityId: event.entityId,
      ...(typeof event.data.taskId === 'number' && {
        taskId: event.data.taskId,
      }),
    };

    // Rooms follow access: the creator of a project and a new member hear about it from now on
    // (they learn the rest over the API).
    if (event.type === 'project.created') {
      this.server.in(userRoom(event.actorId)).socketsJoin(room);
    }
    if (event.type === 'member.added') {
      this.server.in(userRoom(event.entityId)).socketsJoin(room);
    }

    this.server.to(room).emit('domain', payload);

    // The person who was removed gets this last message, then the room is closed to them.
    if (event.type === 'member.removed') {
      this.server.in(userRoom(event.entityId)).socketsLeave(room);
    }
    if (event.type === 'project.deleted') {
      this.server.in(room).socketsLeave(room);
    }
  }

  @OnEvent(NOTIFICATIONS_CREATED)
  onNotificationsCreated(userIds: number[]): void {
    if (!this.server) return;
    for (const userId of userIds) {
      this.server.to(userRoom(userId)).emit('notification');
    }
  }
}

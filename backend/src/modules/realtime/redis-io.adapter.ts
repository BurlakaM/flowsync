import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import IORedis from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Lets several API instances behave as one socket.io server. Each instance only holds its own sockets;
 * with this adapter an `emit` to a room, and `socketsJoin`/`socketsLeave`, travel through Redis to
 * the sockets on the other instances. Without it a second instance would silently miss every live
 * update whose event happened to be handled by the first one.
 *
 * Switched on only with REDIS_URL (see main.ts): a single instance needs no broker.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private readonly clients: IORedis[] = [];

  constructor(
    app: INestApplicationContext,
    private readonly redisUrl: string,
  ) {
    super(app);
  }

  connect(): void {
    // Pub/sub needs two connections: a subscribed connection cannot publish.
    const pub = new IORedis(this.redisUrl);
    const sub = pub.duplicate();
    for (const client of [pub, sub]) {
      // ioredis reconnects by itself; without a listener an outage would be an unhandled 'error' event.
      client.on('error', () => undefined);
      this.clients.push(client);
    }
    this.adapterConstructor = createAdapter(pub, sub);
  }

  createIOServer(port?: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }

  async dispose(): Promise<void> {
    this.clients.forEach((client) => client.disconnect());
    await super.dispose();
  }
}

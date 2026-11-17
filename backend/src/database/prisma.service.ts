import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { AppConfigService } from '../config/app-config.service';

/**
 * The client talks to PostgreSQL through the `pg` driver (Prisma 7 runs queries in TypeScript instead of the
 * Rust engine, and the driver is supplied by the application). The connection string comes from the
 * validated configuration like every other setting.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: AppConfigService) {
    super({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
